import express from "express";
import session from "express-session";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { registerRoutes } from "./routes";
import { initDatabase } from "./init-db";
import path from "path";
import fs from "fs";

const app = express();
const server = createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
    log("WebSocket client connected");

    ws.on("message", (message) => {
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(message.toString());
        }
      });
    });

    ws.on("close", () => {
      log("WebSocket client disconnected");
    });
});

app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(
    session({
      secret: process.env.SESSION_SECRET || "no-sugar-challenge-secret-key",
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 30 * 60 * 1000,
        sameSite: "lax",
      },
    })
);

function log(message: string) {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [express] ${message}`);
}

app.use((req, res, next) => {
    const start = Date.now();
    const reqPath = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (reqPath.startsWith("/api")) {
        let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }
        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }
        log(logLine);
      }
    });

    next();
});

(async () => {
    try {
      await initDatabase();

      registerRoutes(app, wss);

      const isDev = process.env.NODE_ENV !== "production";

      if (isDev) {
        const { setupVite, serveStatic } = await import("./vite");
        const vite = await setupVite(server, app);
        serveStatic(app, vite);
      } else {
        const serverDir = typeof __dirname !== "undefined" ? __dirname : path.dirname(new URL(import.meta.url).pathname);
        const distPublic = path.resolve(serverDir, "public");
        console.log(`Production mode - serving static files from: ${distPublic}`);
        console.log(`Directory exists: ${fs.existsSync(distPublic)}`);
        if (fs.existsSync(distPublic)) {
          const files = fs.readdirSync(distPublic);
          console.log(`Files in dist/public: ${files.join(", ")}`);
          app.use(express.static(distPublic));
        }
        app.get(/^(?!\/api).*$/, (_req, res) => {
          const indexPath = path.join(distPublic, "index.html");
          if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
          } else {
            console.error(`index.html not found at: ${indexPath}`);
            res.status(404).send("Not found");
          }
        });
      }

      const PORT = parseInt(process.env.PORT || "5000", 10);
      server.listen(PORT, "0.0.0.0", () => {
        log(`Server running on port ${PORT} (${isDev ? "development" : "production"})`);
      });
    } catch (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
})();

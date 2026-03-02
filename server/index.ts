import express from "express";
import session from "express-session";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initDatabase } from "./init-db";

const app = express();
const server = createServer(app);

// WebSocket for real-time updates
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
    log("WebSocket client connected");

    ws.on("message", (message) => {
      // Broadcast to all clients
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

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session middleware
app.use(
    session({
      secret: process.env.SESSION_SECRET || "no-sugar-challenge-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 1 day
      },
    })
);

app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
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
      // Initialize database
      await initDatabase();
      
      // Setup Vite (this adds vite.middlewares)
      const vite = await setupVite(server, app);
      
      // Register API routes
      registerRoutes(app);
      
      // Serve static files and handle SPA routing (must be last)
      serveStatic(app, vite);

      const PORT = 5000;
      server.listen(PORT, "0.0.0.0", () => {
        log(`Server running on port ${PORT}`);
      });
    } catch (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
})();

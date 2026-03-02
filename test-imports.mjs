
  import { setupVite, serveStatic, log } from "./server/vite.js";
  import { registerRoutes } from "./server/routes.js";
  import { initDatabase } from "./server/init-db.js";

  console.log("✅ All imports successful");
  console.log("✅ setupVite:", typeof setupVite);
  console.log("✅ serveStatic:", typeof serveStatic);
  console.log("✅ log:", typeof log);
  console.log("✅ registerRoutes:", typeof registerRoutes);
  console.log("✅ initDatabase:", typeof initDatabase);
  
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { deliverPendingPushAlerts, verifyWorkflowToken } from "../pushDelivery";
import { recordCollectionTelemetry } from "../collectionTelemetry";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.post("/api/internal/push-delivery", async (req, res) => {
    const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Missing workflow token." });
    try {
      await verifyWorkflowToken(token);
      return res.json(await deliverPendingPushAlerts());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Push delivery failed.";
      return res.status(message === "Untrusted workflow identity." ? 403 : 500).json({ error: message });
    }
  });
  app.post("/api/internal/collection-telemetry", async (req, res) => {
    const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Missing workflow token." });
    const runId = typeof req.body?.runId === "string" ? req.body.runId : "";
    const status = req.body?.status === "success" || req.body?.status === "failure" ? req.body.status : null;
    const retryAttempts = Number(req.body?.retryAttempts);
    if (!/^\d{1,32}$/.test(runId) || !status || !Number.isInteger(retryAttempts) || retryAttempts < 0 || retryAttempts > 100) return res.status(400).json({ error: "Invalid collection telemetry payload." });
    try {
      await verifyWorkflowToken(token, "japan-seismic-telemetry");
      await recordCollectionTelemetry({ runId, status, retryAttempts });
      return res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Collection telemetry failed.";
      return res.status(message === "Untrusted workflow identity." ? 403 : 500).json({ error: message });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);

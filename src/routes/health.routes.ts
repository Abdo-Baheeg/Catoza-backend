import { Router } from "express";
import { pool } from "../db/index.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  let dbStatus = "ok";
  let latencyMs = 0;

  try {
    const start = Date.now();
    await pool.query("SELECT 1");
    latencyMs = Date.now() - start;
  } catch (err: any) {
    dbStatus = "error: " + err.message;
  }

  res.setHeader("Cache-Control", "no-store");
  res.json({
    status: dbStatus === "ok" ? "healthy" : "degraded",
    database: {
      status: dbStatus,
      latencyMs,
    },
    version: "1.0.0",
    minSupportedAppVersion: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

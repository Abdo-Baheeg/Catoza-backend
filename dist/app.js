import express from "express";
import cors from "cors";
import path from "path";
import { errorHandler, ApiError } from "./errors.js";
import { authRouter } from "./routes/auth.routes.js";
import { householdRouter } from "./routes/household.routes.js";
import { expenseRouter } from "./routes/expense.routes.js";
import { balanceRouter } from "./routes/balance.routes.js";
import { settlementRouter } from "./routes/settlement.routes.js";
import { householdLifeRouter } from "./routes/household-life.routes.js";
import { syncRouter } from "./routes/sync.routes.js";
import { deviceRouter } from "./routes/device.routes.js";
import { uploadRouter } from "./routes/upload.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { internalRouter } from "./routes/internal.routes.js";
export const app = express();
// Middleware
app.use(cors());
app.use(express.json({ limit: "2mb" }));
// Spec: Cache nothing sensitive at the edge; mark API responses Cache-Control: no-store
app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
});
// API Routes mounted under /api/v1
const v1Router = express.Router();
v1Router.use("/health", healthRouter);
v1Router.use("/auth", authRouter);
v1Router.use("/households", householdRouter);
v1Router.use("/", expenseRouter);
v1Router.use("/", balanceRouter);
v1Router.use("/", settlementRouter);
v1Router.use("/", householdLifeRouter);
v1Router.use("/sync", syncRouter);
v1Router.use("/devices", deviceRouter);
v1Router.use("/uploads", uploadRouter);
v1Router.use("/internal", internalRouter);
app.use("/api/v1", v1Router);
// Root health convenience
app.get("/health", (_req, res) => {
    res.redirect("/api/v1/health");
});
// Camera Capture PWA interface for snapping receipts & profile photos
app.get("/camera", (_req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "camera.html"));
});
// Static file serving for uploads and public assets
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use(express.static(path.join(process.cwd(), "public")));
// 404 handler
app.use((_req, _res, next) => {
    next(ApiError.notFound("API endpoint not found"));
});
// Global Error Handler
app.use(errorHandler);
export default app;
//# sourceMappingURL=app.js.map
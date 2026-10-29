import { Router } from "express";
import { InternalService } from "../services/internal.service.js";
import { requireCronSecret } from "../middleware/auth.js";
export const internalRouter = Router();
internalRouter.use(requireCronSecret);
internalRouter.post("/cron/daily", async (_req, res, next) => {
    try {
        const results = await InternalService.runDailySweep();
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            results,
        });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=internal.routes.js.map
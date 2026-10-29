import { Router } from "express";
import { z } from "zod";
import { SyncService } from "../services/sync.service.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
export const syncRouter = Router();
syncRouter.use(requireAuth);
const pushOperationSchema = z.object({
    operationId: z.string().uuid(),
    householdId: z.string().uuid(),
    entityType: z.enum(["expense", "settlement", "note", "shopping_item"]),
    entityId: z.string().uuid(),
    op: z.enum(["create", "update", "delete"]),
    baseVersion: z.number().int(),
    payload: z.record(z.unknown()),
});
const pushBatchSchema = z.object({
    operations: z.array(pushOperationSchema).max(50),
});
syncRouter.post("/push", validate({ body: pushBatchSchema }), async (req, res, next) => {
    try {
        const results = await SyncService.push(req.user.id, req.body.operations);
        res.json({ results });
    }
    catch (error) {
        next(error);
    }
});
syncRouter.get("/pull", async (req, res, next) => {
    try {
        const cursor = req.query.cursor;
        const result = await SyncService.pull(req.user.id, cursor);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=sync.routes.js.map
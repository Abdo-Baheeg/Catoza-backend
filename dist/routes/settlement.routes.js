import { Router } from "express";
import { z } from "zod";
import { SettlementService } from "../services/settlement.service.js";
import { validate } from "../middleware/validate.js";
import { requireAuth, requireHouseholdMember } from "../middleware/auth.js";
export const settlementRouter = Router();
settlementRouter.use(requireAuth);
const createSettlementSchema = z.object({
    fromUser: z.string().uuid(),
    toUser: z.string().uuid(),
    amountMinor: z.union([z.number(), z.string(), z.bigint()]),
    currency: z.string().length(3).optional(),
});
settlementRouter.post("/households/:householdId/settlements", requireHouseholdMember("householdId"), validate({ body: createSettlementSchema }), async (req, res, next) => {
    try {
        const settlement = await SettlementService.createSettlement({
            ...req.body,
            householdId: req.params.householdId,
            createdBy: req.user.id,
        });
        res.status(201).json(settlement);
    }
    catch (error) {
        next(error);
    }
});
settlementRouter.get("/households/:householdId/settlements", requireHouseholdMember("householdId"), async (req, res, next) => {
    try {
        const list = await SettlementService.listSettlements(req.params.householdId);
        res.json(list);
    }
    catch (error) {
        next(error);
    }
});
settlementRouter.post("/settlements/:id/confirm", async (req, res, next) => {
    try {
        const updated = await SettlementService.confirmSettlement(req.params.id, req.user.id);
        res.json(updated);
    }
    catch (error) {
        next(error);
    }
});
settlementRouter.post("/settlements/:id/reject", async (req, res, next) => {
    try {
        const updated = await SettlementService.rejectSettlement(req.params.id, req.user.id);
        res.json(updated);
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=settlement.routes.js.map
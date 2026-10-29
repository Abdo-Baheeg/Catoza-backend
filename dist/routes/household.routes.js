import { Router } from "express";
import { z } from "zod";
import { HouseholdService } from "../services/household.service.js";
import { validate } from "../middleware/validate.js";
import { requireAuth, requireHouseholdMember, requireHouseholdAdmin } from "../middleware/auth.js";
export const householdRouter = Router();
householdRouter.use(requireAuth);
const createHouseholdSchema = z.object({
    name: z.string().min(1).max(100),
    currency: z.string().length(3).optional(),
    timezone: z.string().optional(),
});
const joinHouseholdSchema = z.object({
    inviteCode: z.string().min(4).max(32),
});
const updateMembershipSchema = z.object({
    role: z.enum(["admin", "member"]).optional(),
    status: z.enum(["active", "away", "left"]).optional(),
});
householdRouter.get("/my", async (req, res, next) => {
    try {
        const list = await HouseholdService.getUserHouseholds(req.user.id);
        res.json(list);
    }
    catch (error) {
        next(error);
    }
});
householdRouter.post("/", validate({ body: createHouseholdSchema }), async (req, res, next) => {
    try {
        const result = await HouseholdService.createHousehold(req.user.id, req.body);
        res.status(201).json(result);
    }
    catch (error) {
        next(error);
    }
});
householdRouter.post("/join", validate({ body: joinHouseholdSchema }), async (req, res, next) => {
    try {
        const result = await HouseholdService.joinByInviteCode(req.user.id, req.body.inviteCode);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
householdRouter.get("/:id/members", requireHouseholdMember("id"), async (req, res, next) => {
    try {
        const members = await HouseholdService.listMembers(req.params.id);
        res.json(members);
    }
    catch (error) {
        next(error);
    }
});
householdRouter.post("/:id/invite-code", requireHouseholdMember("id"), requireHouseholdAdmin, async (req, res, next) => {
    try {
        const result = await HouseholdService.generateNewInviteCode(req.params.id);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
householdRouter.patch("/memberships/:id", validate({ body: updateMembershipSchema }), async (req, res, next) => {
    try {
        const updated = await HouseholdService.updateMembership(req.params.id, req.body);
        res.json(updated);
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=household.routes.js.map
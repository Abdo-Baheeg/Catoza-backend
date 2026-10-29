import { Router } from "express";
import { z } from "zod";
import { HouseholdLifeService } from "../services/household-life.service.js";
import { validate } from "../middleware/validate.js";
import { requireAuth, requireHouseholdMember } from "../middleware/auth.js";
export const householdLifeRouter = Router();
householdLifeRouter.use(requireAuth);
// === NOTES ===
const createNoteSchema = z.object({
    title: z.string().max(100).optional(),
    body: z.string().min(1).max(5000),
    recipientId: z.string().uuid().optional(),
    pinned: z.boolean().optional(),
    visibility: z.enum(["all", "private"]).optional(),
});
householdLifeRouter.post("/households/:householdId/notes", requireHouseholdMember("householdId"), validate({ body: createNoteSchema }), async (req, res, next) => {
    try {
        const note = await HouseholdLifeService.createNote({
            ...req.body,
            householdId: req.params.householdId,
            authorId: req.user.id,
        });
        res.status(201).json(note);
    }
    catch (error) {
        next(error);
    }
});
householdLifeRouter.get("/households/:householdId/notes", requireHouseholdMember("householdId"), async (req, res, next) => {
    try {
        const notes = await HouseholdLifeService.listNotes(req.params.householdId, req.user.id);
        res.json(notes);
    }
    catch (error) {
        next(error);
    }
});
householdLifeRouter.post("/notes/:id/read", async (req, res, next) => {
    try {
        const result = await HouseholdLifeService.markNoteAsRead(req.params.id, req.user.id);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
householdLifeRouter.delete("/notes/:id", async (req, res, next) => {
    try {
        const result = await HouseholdLifeService.deleteNote(req.params.id, req.user.id);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// === CHORES ===
const createChoreSchema = z.object({
    title: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    rotationUserIds: z.array(z.string().uuid()).min(1),
    frequency: z.string().default("weekly"),
    firstDueOn: z.string().datetime().optional(),
});
householdLifeRouter.post("/households/:householdId/chores", requireHouseholdMember("householdId"), validate({ body: createChoreSchema }), async (req, res, next) => {
    try {
        const chore = await HouseholdLifeService.createChore({
            ...req.body,
            householdId: req.params.householdId,
        });
        res.status(201).json(chore);
    }
    catch (error) {
        next(error);
    }
});
householdLifeRouter.get("/households/:householdId/chores", requireHouseholdMember("householdId"), async (req, res, next) => {
    try {
        const chores = await HouseholdLifeService.listChores(req.params.householdId);
        res.json(chores);
    }
    catch (error) {
        next(error);
    }
});
householdLifeRouter.get("/households/:householdId/chores/assignments", requireHouseholdMember("householdId"), async (req, res, next) => {
    try {
        const assignments = await HouseholdLifeService.listChoreAssignments(req.params.householdId);
        res.json(assignments);
    }
    catch (error) {
        next(error);
    }
});
householdLifeRouter.patch("/chores/assignments/:id", async (req, res, next) => {
    try {
        const status = req.body.status;
        const updated = await HouseholdLifeService.updateChoreAssignment(req.params.id, status || "completed", req.user.id);
        res.json(updated);
    }
    catch (error) {
        next(error);
    }
});
// === SHOPPING ITEMS ===
const createShoppingSchema = z.object({
    name: z.string().min(1).max(100),
    qty: z.string().max(20).optional(),
});
const convertShoppingSchema = z.object({
    itemIds: z.array(z.string().uuid()).min(1),
    payerId: z.string().uuid(),
    amountMinor: z.union([z.number(), z.string(), z.bigint()]),
    participantIds: z.array(z.string().uuid()).min(1),
});
householdLifeRouter.post("/households/:householdId/shopping", requireHouseholdMember("householdId"), validate({ body: createShoppingSchema }), async (req, res, next) => {
    try {
        const item = await HouseholdLifeService.addShoppingItem({
            ...req.body,
            householdId: req.params.householdId,
            addedBy: req.user.id,
        });
        res.status(201).json(item);
    }
    catch (error) {
        next(error);
    }
});
householdLifeRouter.get("/households/:householdId/shopping", requireHouseholdMember("householdId"), async (req, res, next) => {
    try {
        const items = await HouseholdLifeService.listShoppingItems(req.params.householdId);
        res.json(items);
    }
    catch (error) {
        next(error);
    }
});
householdLifeRouter.patch("/shopping/:id", async (req, res, next) => {
    try {
        const updated = await HouseholdLifeService.updateShoppingItem(req.params.id, {
            ...req.body,
            boughtBy: req.user.id,
        });
        res.json(updated);
    }
    catch (error) {
        next(error);
    }
});
householdLifeRouter.post("/households/:householdId/shopping/to-expense", requireHouseholdMember("householdId"), validate({ body: convertShoppingSchema }), async (req, res, next) => {
    try {
        const expense = await HouseholdLifeService.convertShoppingItemsToExpense({
            ...req.body,
            householdId: req.params.householdId,
        });
        res.status(201).json(expense);
    }
    catch (error) {
        next(error);
    }
});
// === POLLS ===
const createPollSchema = z.object({
    question: z.string().min(1).max(300),
    options: z.array(z.string().min(1).max(100)).min(2),
    closesAt: z.string().datetime().optional(),
});
householdLifeRouter.post("/households/:householdId/polls", requireHouseholdMember("householdId"), validate({ body: createPollSchema }), async (req, res, next) => {
    try {
        const poll = await HouseholdLifeService.createPoll({
            ...req.body,
            householdId: req.params.householdId,
            createdBy: req.user.id,
        });
        res.status(201).json(poll);
    }
    catch (error) {
        next(error);
    }
});
householdLifeRouter.get("/households/:householdId/polls", requireHouseholdMember("householdId"), async (req, res, next) => {
    try {
        const polls = await HouseholdLifeService.listPolls(req.params.householdId);
        res.json(polls);
    }
    catch (error) {
        next(error);
    }
});
householdLifeRouter.post("/polls/:id/vote", async (req, res, next) => {
    try {
        const pollOptionId = req.body.pollOptionId;
        const result = await HouseholdLifeService.votePoll(pollOptionId, req.user.id);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// === AWAY PERIODS ===
const createAwaySchema = z.object({
    startsOn: z.string().datetime(),
    endsOn: z.string().datetime(),
});
householdLifeRouter.post("/households/:householdId/away-periods", requireHouseholdMember("householdId"), validate({ body: createAwaySchema }), async (req, res, next) => {
    try {
        const away = await HouseholdLifeService.addAwayPeriod({
            ...req.body,
            householdId: req.params.householdId,
            userId: req.user.id,
        });
        res.status(201).json(away);
    }
    catch (error) {
        next(error);
    }
});
householdLifeRouter.get("/households/:householdId/away-periods", requireHouseholdMember("householdId"), async (req, res, next) => {
    try {
        const periods = await HouseholdLifeService.listAwayPeriods(req.params.householdId);
        res.json(periods);
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=household-life.routes.js.map
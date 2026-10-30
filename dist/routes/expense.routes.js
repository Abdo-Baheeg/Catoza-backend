import { Router } from "express";
import { z } from "zod";
import { ExpenseService } from "../services/expense.service.js";
import { validate } from "../middleware/validate.js";
import { requireAuth, requireHouseholdMember } from "../middleware/auth.js";
export const expenseRouter = Router();
expenseRouter.use(requireAuth);
const participantSchema = z.object({
    userId: z.string().uuid(),
    exactMinor: z.union([z.number(), z.string(), z.bigint()]).optional(),
    percentage: z.number().optional(),
    shares: z.number().optional(),
});
const urlOrPathSchema = z.string().refine((val) => val.startsWith("/") || /^https?:\/\//i.test(val), { message: "Must be a valid URL or path starting with '/'" });
const createExpenseSchema = z.object({
    householdId: z.string().uuid().optional(),
    payerId: z.string().uuid(),
    title: z.string().min(1).max(200),
    notes: z.string().max(1000).optional(),
    amountMinor: z.union([z.number(), z.string(), z.bigint()]),
    currency: z.string().length(3).optional(),
    category: z.string().max(50).optional(),
    expenseDate: z.string().datetime().optional(),
    splitMethod: z.enum(["equal", "exact", "percentage", "shares"]).default("equal"),
    participants: z.array(participantSchema).min(1),
    receiptUrl: urlOrPathSchema.optional(),
});
const updateExpenseSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    notes: z.string().max(1000).optional(),
    amountMinor: z.union([z.number(), z.string(), z.bigint()]).optional(),
    category: z.string().max(50).optional(),
    expenseDate: z.string().datetime().optional(),
    splitMethod: z.enum(["equal", "exact", "percentage", "shares"]).optional(),
    participants: z.array(participantSchema).optional(),
    receiptUrl: urlOrPathSchema.optional(),
    baseVersion: z.number().int().positive(),
});
const commentSchema = z.object({
    body: z.string().min(1).max(1000),
});
// Create expense within household
expenseRouter.post("/households/:householdId/expenses", requireHouseholdMember("householdId"), validate({ body: createExpenseSchema }), async (req, res, next) => {
    try {
        const expense = await ExpenseService.createExpense({
            ...req.body,
            householdId: req.params.householdId,
            createdBy: req.user.id,
        });
        res.status(201).json(expense);
    }
    catch (error) {
        next(error);
    }
});
// List expenses within household
expenseRouter.get("/households/:householdId/expenses", requireHouseholdMember("householdId"), async (req, res, next) => {
    try {
        const expenses = await ExpenseService.listExpenses(req.params.householdId, {
            category: req.query.category,
            status: req.query.status,
            limit: req.query.limit ? parseInt(req.query.limit) : undefined,
            offset: req.query.offset ? parseInt(req.query.offset) : undefined,
        });
        res.json(expenses);
    }
    catch (error) {
        next(error);
    }
});
// Detail of single expense
expenseRouter.get("/expenses/:id", async (req, res, next) => {
    try {
        const expense = await ExpenseService.getExpense(req.params.id);
        res.json(expense);
    }
    catch (error) {
        next(error);
    }
});
// Update expense with optimistic concurrency check
expenseRouter.patch("/expenses/:id", validate({ body: updateExpenseSchema }), async (req, res, next) => {
    try {
        const updated = await ExpenseService.updateExpense(req.params.id, req.user.id, req.body);
        res.json(updated);
    }
    catch (error) {
        next(error);
    }
});
// Cancel expense
expenseRouter.post("/expenses/:id/cancel", async (req, res, next) => {
    try {
        const cancelled = await ExpenseService.cancelExpense(req.params.id, req.user.id);
        res.json(cancelled);
    }
    catch (error) {
        next(error);
    }
});
// Dispute expense
expenseRouter.post("/expenses/:id/dispute", async (req, res, next) => {
    try {
        const disputed = await ExpenseService.disputeExpense(req.params.id, req.user.id, req.body.reason);
        res.json(disputed);
    }
    catch (error) {
        next(error);
    }
});
// Add comment to expense
expenseRouter.post("/expenses/:id/comments", validate({ body: commentSchema }), async (req, res, next) => {
    try {
        const comment = await ExpenseService.addComment(req.params.id, req.user.id, req.body.body);
        res.status(201).json(comment);
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=expense.routes.js.map
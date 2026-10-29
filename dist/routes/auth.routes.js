import { Router } from "express";
import { z } from "zod";
import { AuthService } from "../services/auth.service.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
export const authRouter = Router();
const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    displayName: z.string().min(1).max(100),
    avatarUrl: z.string().url().optional(),
});
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
    deviceName: z.string().max(100).optional(),
});
const refreshSchema = z.object({
    refreshToken: z.string(),
});
authRouter.post("/register", validate({ body: registerSchema }), async (req, res, next) => {
    try {
        const result = await AuthService.register(req.body);
        res.status(201).json(result);
    }
    catch (error) {
        next(error);
    }
});
authRouter.post("/login", validate({ body: loginSchema }), async (req, res, next) => {
    try {
        const result = await AuthService.login(req.body);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
authRouter.post("/refresh", validate({ body: refreshSchema }), async (req, res, next) => {
    try {
        const tokens = await AuthService.refresh(req.body.refreshToken);
        res.json(tokens);
    }
    catch (error) {
        next(error);
    }
});
authRouter.post("/logout", validate({ body: refreshSchema }), async (req, res, next) => {
    try {
        await AuthService.logout(req.body.refreshToken);
        res.json({ message: "Logged out successfully" });
    }
    catch (error) {
        next(error);
    }
});
authRouter.get("/me", requireAuth, async (req, res, next) => {
    try {
        const user = await AuthService.getMe(req.user.id);
        res.json(user);
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=auth.routes.js.map
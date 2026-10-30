import { Router } from "express";
import { z } from "zod";
import { AuthService } from "../services/auth.service.js";
import { UploadService } from "../services/upload.service.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

const urlOrPathSchema = z.string().refine(
  (val) => val.startsWith("/") || /^https?:\/\//i.test(val),
  { message: "Must be a valid URL or path starting with '/'" }
);

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100),
  avatarUrl: urlOrPathSchema.optional(),
  instapayLink: z.string().max(255).optional(),
  instapayUsername: z.string().max(100).optional(),
});

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: urlOrPathSchema.optional(),
  instapayLink: z.string().max(255).optional(),
  instapayUsername: z.string().max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  deviceName: z.string().max(100).optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

authRouter.post(
  "/register",
  validate({ body: registerSchema }),
  async (req, res, next) => {
    try {
      const result = await AuthService.register(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

authRouter.post(
  "/login",
  validate({ body: loginSchema }),
  async (req, res, next) => {
    try {
      const result = await AuthService.login(req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

authRouter.post(
  "/refresh",
  validate({ body: refreshSchema }),
  async (req, res, next) => {
    try {
      const tokens = await AuthService.refresh(req.body.refreshToken);
      res.json(tokens);
    } catch (error) {
      next(error);
    }
  }
);

authRouter.post(
  "/logout",
  validate({ body: refreshSchema }),
  async (req, res, next) => {
    try {
      await AuthService.logout(req.body.refreshToken);
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      next(error);
    }
  }
);

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await AuthService.getMe(req.user!.id);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

authRouter.patch(
  "/me",
  requireAuth,
  validate({ body: updateProfileSchema }),
  async (req, res, next) => {
    try {
      const updated = await AuthService.updateProfile(req.user!.id, req.body);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

const uploadAvatarSchema = z.object({
  imageBase64: z.string().min(10, "Base64 image is required"),
  filename: z.string().optional(),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
});

authRouter.post(
  "/me/avatar",
  requireAuth,
  validate({ body: uploadAvatarSchema }),
  async (req, res, next) => {
    try {
      const upload = await UploadService.saveImage({
        base64Data: req.body.imageBase64,
        type: "avatars",
        filename: req.body.filename,
        contentType: req.body.contentType,
      });

      const updated = await AuthService.updateProfile(req.user!.id, {
        avatarUrl: upload.url,
      });

      res.status(201).json({
        user: updated,
        upload,
      });
    } catch (error) {
      next(error);
    }
  }
);

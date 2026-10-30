import { Router } from "express";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { UploadService } from "../services/upload.service.js";
import { ApiError } from "../errors.js";

export const uploadRouter = Router();

const metadataSchema = z.object({
  filename: z.string().optional(),
  contentType: z.string().optional(),
  sizeBytes: z.number().int().positive().optional(),
});

const directUploadSchema = z.object({
  imageBase64: z.string().min(10, "Base64 image data is required"),
  type: z.enum(["receipts", "avatars"]).default("receipts"),
  filename: z.string().optional(),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
});

// Require authentication for upload operations
uploadRouter.use(requireAuth);

/**
 * POST /api/v1/uploads/receipt
 * Returns signed target URL or endpoint for receipt photo upload.
 */
uploadRouter.post(
  "/receipt",
  validate({ body: metadataSchema }),
  async (req, res, next) => {
    try {
      const meta = UploadService.getUploadMetadata({
        type: "receipts",
        filename: req.body.filename,
        contentType: req.body.contentType,
        sizeBytes: req.body.sizeBytes,
      });
      res.json(meta);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/uploads/avatar
 * Returns signed target URL or endpoint for user profile photo upload.
 */
uploadRouter.post(
  "/avatar",
  validate({ body: metadataSchema }),
  async (req, res, next) => {
    try {
      const meta = UploadService.getUploadMetadata({
        type: "avatars",
        filename: req.body.filename,
        contentType: req.body.contentType,
        sizeBytes: req.body.sizeBytes,
      });
      res.json(meta);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/uploads/direct
 * Directly accepts a base64 encoded photo (under 500 KB) captured by camera or picker.
 * Saves to Vercel Blob (in prod) or local disk (in dev) and returns the public URL.
 */
uploadRouter.post(
  "/direct",
  validate({ body: directUploadSchema }),
  async (req, res, next) => {
    try {
      const result = await UploadService.saveImage({
        base64Data: req.body.imageBase64,
        type: req.body.type,
        filename: req.body.filename,
        contentType: req.body.contentType,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/uploads/:type/:filename
 * Serves locally stored images during local development or when Vercel Blob is not configured.
 */
uploadRouter.get("/:type/:filename", async (req, res, next) => {
  try {
    const { type, filename } = req.params;
    if (type !== "receipts" && type !== "avatars") {
      throw ApiError.notFound("Folder not found");
    }

    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), "uploads", type, safeFilename);

    if (!fs.existsSync(filePath)) {
      throw ApiError.notFound("File not found");
    }

    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

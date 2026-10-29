import { Router } from "express";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../errors.js";

export const uploadRouter = Router();

uploadRouter.use(requireAuth);

const MAX_BYTES = parseInt(process.env.RECEIPT_MAX_BYTES || "524288", 10); // 500 KB cap

uploadRouter.post("/receipt", async (req, res, next) => {
  try {
    const { filename, contentType, sizeBytes } = req.body;

    if (sizeBytes && sizeBytes > MAX_BYTES) {
      throw ApiError.badRequest(
        `File size exceeds 500 KB free-tier limit (${sizeBytes} bytes)`,
        "FILE_TOO_LARGE"
      );
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (contentType && !allowedTypes.includes(contentType)) {
      throw ApiError.badRequest("Only JPEG, PNG, and WebP receipts are accepted", "INVALID_FILE_TYPE");
    }

    const uniqueKey = `receipts/${crypto.randomBytes(16).toString("hex")}-${filename || "receipt.jpg"}`;

    // On Vercel with Vercel Blob:
    // When BLOB_READ_WRITE_TOKEN is configured, return signed upload URL / client token
    // If running in development without Blob, return a stub URL
    const uploadUrl = process.env.BLOB_READ_WRITE_TOKEN
      ? `https://blob.vercel-storage.com/${uniqueKey}`
      : `/uploads/${uniqueKey}`;

    res.json({
      uploadUrl,
      fileKey: uniqueKey,
      maxSizeBytes: MAX_BYTES,
    });
  } catch (error) {
    next(error);
  }
});

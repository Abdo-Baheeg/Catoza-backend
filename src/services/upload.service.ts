import crypto from "crypto";
import fs from "fs";
import path from "path";
import { ApiError } from "../errors.js";

const MAX_BYTES = parseInt(process.env.RECEIPT_MAX_BYTES || "524288", 10); // 500 KB free-tier cap
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface UploadResult {
  url: string;
  fileKey: string;
  sizeBytes: number;
  contentType: string;
}

export class UploadService {
  /**
   * Save a base64 or raw image buffer either to Vercel Blob (in production)
   * or to local disk under ./uploads/ (in development/fallback).
   */
  static async saveImage(options: {
    base64Data: string;
    type: "receipts" | "avatars";
    filename?: string;
    contentType?: string;
  }): Promise<UploadResult> {
    const { base64Data, type, filename } = options;

    // Detect and extract data URL format: data:image/jpeg;base64,....
    let rawBase64 = base64Data;
    let detectedType = options.contentType;

    const dataUrlMatch = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (dataUrlMatch) {
      detectedType = dataUrlMatch[1];
      rawBase64 = dataUrlMatch[2];
    }

    const contentType = detectedType || "image/jpeg";
    if (!ALLOWED_MIME_TYPES.includes(contentType)) {
      throw ApiError.badRequest(
        `Invalid image type '${contentType}'. Only JPEG, PNG, and WebP are allowed.`,
        "INVALID_FILE_TYPE"
      );
    }

    const buffer = Buffer.from(rawBase64, "base64");

    if (buffer.length === 0) {
      throw ApiError.badRequest("Image data is empty", "EMPTY_PAYLOAD");
    }

    if (buffer.length > MAX_BYTES) {
      throw ApiError.badRequest(
        `Image size (${buffer.length} bytes) exceeds the 500 KB limit. Compress the photo before uploading.`,
        "FILE_TOO_LARGE"
      );
    }

    const ext = contentType === "image/png" ? ".png" : contentType === "image/webp" ? ".webp" : ".jpg";
    const cleanFilename = filename ? path.basename(filename).replace(/[^a-zA-Z0-9.-]/g, "_") : `photo${ext}`;
    const uniqueKey = `${type}/${crypto.randomBytes(12).toString("hex")}-${cleanFilename}`;

    // If Vercel Blob is configured (production)
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const response = await fetch(`https://blob.vercel-storage.com/${uniqueKey}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
            "x-content-type": contentType,
            "x-add-random-suffix": "1",
          },
          body: buffer,
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Vercel Blob error (${response.status}): ${errText}`);
        }

        const data = (await response.json()) as { url: string; pathname?: string };
        return {
          url: data.url,
          fileKey: uniqueKey,
          sizeBytes: buffer.length,
          contentType,
        };
      } catch (err: any) {
        console.error("Vercel Blob upload failed, falling back to local storage:", err.message);
      }
    }

    // Local / development storage fallback
    const uploadsDir = path.join(process.cwd(), "uploads", type);
    await fs.promises.mkdir(uploadsDir, { recursive: true });

    const localFilePath = path.join(process.cwd(), "uploads", uniqueKey);
    await fs.promises.writeFile(localFilePath, buffer);

    const publicUrl = `/uploads/${uniqueKey}`;

    return {
      url: publicUrl,
      fileKey: uniqueKey,
      sizeBytes: buffer.length,
      contentType,
    };
  }

  /**
   * Generates a pre-signed or direct upload metadata descriptor for clients.
   */
  static getUploadMetadata(options: {
    type: "receipts" | "avatars";
    filename?: string;
    contentType?: string;
    sizeBytes?: number;
  }) {
    const { type, filename, contentType, sizeBytes } = options;

    if (sizeBytes && sizeBytes > MAX_BYTES) {
      throw ApiError.badRequest(
        `File size exceeds 500 KB limit (${sizeBytes} bytes)`,
        "FILE_TOO_LARGE"
      );
    }

    if (contentType && !ALLOWED_MIME_TYPES.includes(contentType)) {
      throw ApiError.badRequest(
        `Only JPEG, PNG, and WebP are accepted (received: ${contentType})`,
        "INVALID_FILE_TYPE"
      );
    }

    const ext = contentType === "image/png" ? ".png" : contentType === "image/webp" ? ".webp" : ".jpg";
    const cleanFilename = filename ? path.basename(filename).replace(/[^a-zA-Z0-9.-]/g, "_") : `photo${ext}`;
    const uniqueKey = `${type}/${crypto.randomBytes(12).toString("hex")}-${cleanFilename}`;

    const uploadUrl = process.env.BLOB_READ_WRITE_TOKEN
      ? `https://blob.vercel-storage.com/${uniqueKey}`
      : `/uploads/${uniqueKey}`;

    return {
      uploadUrl,
      fileKey: uniqueKey,
      maxSizeBytes: MAX_BYTES,
      allowedTypes: ALLOWED_MIME_TYPES,
    };
  }
}

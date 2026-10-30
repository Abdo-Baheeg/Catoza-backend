import { describe, it, expect, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import { UploadService } from "../upload.service.js";

describe("UploadService", () => {
  const uploadsDir = path.join(process.cwd(), "uploads");

  afterAll(async () => {
    // Clean up created test uploads folder
    if (fs.existsSync(uploadsDir)) {
      await fs.promises.rm(uploadsDir, { recursive: true, force: true });
    }
  });

  it("should parse Cloudflare R2 URL correctly", () => {
    const originalUrl = process.env.R2_URL;
    try {
      process.env.R2_URL = "https://002a043468f0003307e86563ada4b83e.r2.cloudflarestorage.com/catoza";
      const config = UploadService.getR2Config();
      expect(config.endpoint).toBe("https://002a043468f0003307e86563ada4b83e.r2.cloudflarestorage.com");
      expect(config.bucket).toBe("catoza");
      expect(config.accountId).toBe("002a043468f0003307e86563ada4b83e");
    } finally {
      if (originalUrl !== undefined) {
        process.env.R2_URL = originalUrl;
      } else {
        delete process.env.R2_URL;
      }
    }
  });

  it("should generate upload metadata correctly", async () => {
    const meta = await UploadService.getUploadMetadata({
      type: "receipts",
      filename: "receipt.jpg",
      contentType: "image/jpeg",
      sizeBytes: 150000,
    });

    expect(meta.uploadUrl).toBeDefined();
    expect(meta.fileKey).toContain("receipts/");
    expect(meta.maxSizeBytes).toBe(524288);
  });

  it("should reject metadata for file size exceeding 500 KB", async () => {
    await expect(
      UploadService.getUploadMetadata({
        type: "receipts",
        sizeBytes: 600000,
      })
    ).rejects.toThrow("exceeds 500 KB limit");
  });

  it("should reject metadata for invalid mime type", async () => {
    await expect(
      UploadService.getUploadMetadata({
        type: "receipts",
        contentType: "application/pdf",
      })
    ).rejects.toThrow("Only JPEG, PNG, and WebP are accepted");
  });

  it("should successfully save a valid base64 receipt photo", async () => {
    // Create a 1x1 transparent PNG in base64
    const validPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    const result = await UploadService.saveImage({
      base64Data: `data:image/png;base64,${validPngBase64}`,
      type: "receipts",
      filename: "test_receipt.png",
    });

    expect(result.url).toContain("/uploads/receipts/");
    expect(result.fileKey).toContain("receipts/");
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(result.contentType).toBe("image/png");

    const fullPath = path.join(process.cwd(), "uploads", result.fileKey);
    expect(fs.existsSync(fullPath)).toBe(true);
  });

  it("should successfully save an avatar photo", async () => {
    const validPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    const result = await UploadService.saveImage({
      base64Data: validPngBase64,
      type: "avatars",
      filename: "avatar.jpg",
      contentType: "image/jpeg",
    });

    expect(result.url).toContain("/uploads/avatars/");
    expect(result.fileKey).toContain("avatars/");
    expect(result.contentType).toBe("image/jpeg");
  });

  it("should reject base64 payload exceeding 500 KB", async () => {
    // Create a large fake buffer > 500 KB (550 KB)
    const largeBuffer = Buffer.alloc(550 * 1024, "a");
    const largeBase64 = largeBuffer.toString("base64");

    await expect(
      UploadService.saveImage({
        base64Data: largeBase64,
        type: "receipts",
      })
    ).rejects.toThrow("exceeds the 500 KB limit");
  });

  it("should generate pre-signed upload URL when R2 credentials exist", async () => {
    const originalKey = process.env.R2_ACCESS_KEY_ID;
    const originalSecret = process.env.R2_SECRET_ACCESS_KEY;
    try {
      process.env.R2_ACCESS_KEY_ID = "test-access-key-id";
      process.env.R2_SECRET_ACCESS_KEY = "test-secret-access-key-mock";

      const meta = await UploadService.getUploadMetadata({
        type: "receipts",
        filename: "test.jpg",
        contentType: "image/jpeg",
      });

      expect(meta.uploadUrl).toContain("https://002a043468f0003307e86563ada4b83e.r2.cloudflarestorage.com/catoza/receipts/");
      expect(meta.uploadUrl).toContain("X-Amz-Signature");
    } finally {
      if (originalKey !== undefined) {
        process.env.R2_ACCESS_KEY_ID = originalKey;
      } else {
        delete process.env.R2_ACCESS_KEY_ID;
      }
      if (originalSecret !== undefined) {
        process.env.R2_SECRET_ACCESS_KEY = originalSecret;
      } else {
        delete process.env.R2_SECRET_ACCESS_KEY;
      }
    }
  });

  it("should delete a locally saved file using deleteFile", async () => {
    const validPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const result = await UploadService.saveImage({
      base64Data: validPngBase64,
      type: "receipts",
      filename: "to_delete.png",
      contentType: "image/png",
    });

    const fullPath = path.join(process.cwd(), "uploads", result.fileKey);
    expect(fs.existsSync(fullPath)).toBe(true);

    const deleted = await UploadService.deleteFile(result.fileKey);
    expect(deleted).toBe(true);
    expect(fs.existsSync(fullPath)).toBe(false);
  });
});

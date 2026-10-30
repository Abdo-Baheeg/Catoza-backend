import { describe, it, expect, beforeEach, afterAll } from "vitest";
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

  it("should generate upload metadata correctly", () => {
    const meta = UploadService.getUploadMetadata({
      type: "receipts",
      filename: "receipt.jpg",
      contentType: "image/jpeg",
      sizeBytes: 150000,
    });

    expect(meta.uploadUrl).toBeDefined();
    expect(meta.fileKey).toContain("receipts/");
    expect(meta.maxSizeBytes).toBe(524288);
  });

  it("should reject metadata for file size exceeding 500 KB", () => {
    expect(() =>
      UploadService.getUploadMetadata({
        type: "receipts",
        sizeBytes: 600000,
      })
    ).toThrow("exceeds 500 KB limit");
  });

  it("should reject metadata for invalid mime type", () => {
    expect(() =>
      UploadService.getUploadMetadata({
        type: "receipts",
        contentType: "application/pdf",
      })
    ).toThrow("Only JPEG, PNG, and WebP are accepted");
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
});

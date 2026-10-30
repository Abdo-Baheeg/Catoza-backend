import crypto from "crypto";
import fs from "fs";
import path from "path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ApiError } from "../errors.js";
const MAX_BYTES = parseInt(process.env.RECEIPT_MAX_BYTES || "524288", 10); // 500 KB free-tier cap
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
let cachedS3Client = null;
let lastS3ClientKey = "";
export class UploadService {
    /**
     * Resolve Cloudflare R2 configuration from environment variables.
     * Supports R2_URL (e.g. https://002a043468f0003307e86563ada4b83e.r2.cloudflarestorage.com/catoza)
     * or explicit individual env vars.
     */
    static getR2Config() {
        let endpoint = process.env.R2_ENDPOINT;
        let bucket = process.env.R2_BUCKET;
        let accountId = process.env.R2_ACCOUNT_ID;
        const r2Url = process.env.R2_URL;
        if (r2Url && r2Url.trim() && r2Url !== "undefined") {
            try {
                const parsed = new URL(r2Url);
                endpoint = `${parsed.protocol}//${parsed.host}`;
                const pathPart = parsed.pathname.replace(/^\/+/, "").split("/")[0];
                if (pathPart) {
                    bucket = bucket || pathPart;
                }
                const match = parsed.host.match(/^([a-f0-9]+)\.r2\.cloudflarestorage\.com$/i);
                if (match) {
                    accountId = accountId || match[1];
                }
            }
            catch (err) {
                console.warn("Failed to parse R2_URL:", err);
            }
        }
        if (!endpoint && accountId) {
            endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
        }
        return {
            endpoint: endpoint || "https://002a043468f0003307e86563ada4b83e.r2.cloudflarestorage.com",
            bucket: bucket || "catoza",
            accountId: accountId || "002a043468f0003307e86563ada4b83e",
            accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
            publicUrl: process.env.R2_PUBLIC_URL || "",
        };
    }
    /**
     * Instantiate or return cached S3Client configured for Cloudflare R2.
     * Uses forcePathStyle: true so that S3 endpoints like:
     * https://<account_id>.r2.cloudflarestorage.com/<bucket>/<key> work as expected.
     */
    static getS3Client() {
        const config = this.getR2Config();
        if (!config.accessKeyId || !config.secretAccessKey) {
            cachedS3Client = null;
            lastS3ClientKey = "";
            return null;
        }
        const clientKey = `${config.endpoint}:${config.accessKeyId}`;
        if (cachedS3Client && lastS3ClientKey === clientKey) {
            return cachedS3Client;
        }
        cachedS3Client = new S3Client({
            region: "auto",
            endpoint: config.endpoint,
            forcePathStyle: true,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
            },
        });
        lastS3ClientKey = clientKey;
        return cachedS3Client;
    }
    /**
     * Format public access URL for a stored key.
     */
    static resolvePublicUrl(fileKey) {
        const config = this.getR2Config();
        if (config.publicUrl) {
            return `${config.publicUrl.replace(/\/+$/, "")}/${fileKey}`;
        }
        return `/uploads/${fileKey}`;
    }
    /**
     * Save a base64 or raw image buffer either to Cloudflare R2 (when credentials provided),
     * Vercel Blob (fallback), or local disk under ./uploads/ (dev fallback).
     */
    static async saveImage(options) {
        const { base64Data, type, filename } = options;
        let rawBase64 = base64Data;
        let detectedType = options.contentType;
        const dataUrlMatch = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (dataUrlMatch) {
            detectedType = dataUrlMatch[1];
            rawBase64 = dataUrlMatch[2];
        }
        const contentType = detectedType || "image/jpeg";
        if (!ALLOWED_MIME_TYPES.includes(contentType)) {
            throw ApiError.badRequest(`Invalid image type '${contentType}'. Only JPEG, PNG, and WebP are allowed.`, "INVALID_FILE_TYPE");
        }
        const buffer = Buffer.from(rawBase64, "base64");
        if (buffer.length === 0) {
            throw ApiError.badRequest("Image data is empty", "EMPTY_PAYLOAD");
        }
        if (buffer.length > MAX_BYTES) {
            throw ApiError.badRequest(`Image size (${buffer.length} bytes) exceeds the 500 KB limit. Compress the photo before uploading.`, "FILE_TOO_LARGE");
        }
        const ext = contentType === "image/png" ? ".png" : contentType === "image/webp" ? ".webp" : ".jpg";
        const cleanFilename = filename ? path.basename(filename).replace(/[^a-zA-Z0-9.-]/g, "_") : `photo${ext}`;
        const uniqueKey = `${type}/${crypto.randomBytes(12).toString("hex")}-${cleanFilename}`;
        const s3 = this.getS3Client();
        const r2Config = this.getR2Config();
        // 1. Cloudflare R2 Upload
        if (s3 && r2Config.bucket) {
            try {
                await s3.send(new PutObjectCommand({
                    Bucket: r2Config.bucket,
                    Key: uniqueKey,
                    Body: buffer,
                    ContentType: contentType,
                }));
                return {
                    url: this.resolvePublicUrl(uniqueKey),
                    fileKey: uniqueKey,
                    sizeBytes: buffer.length,
                    contentType,
                };
            }
            catch (err) {
                console.error("Cloudflare R2 upload failed, attempting fallback:", err.message);
            }
        }
        // 2. Vercel Blob Upload Fallback
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
                const data = (await response.json());
                return {
                    url: data.url,
                    fileKey: uniqueKey,
                    sizeBytes: buffer.length,
                    contentType,
                };
            }
            catch (err) {
                console.error("Vercel Blob upload failed, falling back to local storage:", err.message);
            }
        }
        // 3. Local Disk Storage Fallback
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
     * If Cloudflare R2 is configured with credentials, generates an S3 pre-signed PUT URL.
     */
    static async getUploadMetadata(options) {
        const { type, filename, contentType, sizeBytes } = options;
        if (sizeBytes && sizeBytes > MAX_BYTES) {
            throw ApiError.badRequest(`File size exceeds 500 KB limit (${sizeBytes} bytes)`, "FILE_TOO_LARGE");
        }
        if (contentType && !ALLOWED_MIME_TYPES.includes(contentType)) {
            throw ApiError.badRequest(`Only JPEG, PNG, and WebP are accepted (received: ${contentType})`, "INVALID_FILE_TYPE");
        }
        const mime = contentType || "image/jpeg";
        const ext = mime === "image/png" ? ".png" : mime === "image/webp" ? ".webp" : ".jpg";
        const cleanFilename = filename ? path.basename(filename).replace(/[^a-zA-Z0-9.-]/g, "_") : `photo${ext}`;
        const uniqueKey = `${type}/${crypto.randomBytes(12).toString("hex")}-${cleanFilename}`;
        const s3 = this.getS3Client();
        const r2Config = this.getR2Config();
        let uploadUrl;
        const publicUrl = this.resolvePublicUrl(uniqueKey);
        if (s3 && r2Config.bucket) {
            try {
                const command = new PutObjectCommand({
                    Bucket: r2Config.bucket,
                    Key: uniqueKey,
                    ContentType: mime,
                });
                uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
            }
            catch (err) {
                console.error("Failed to generate R2 pre-signed URL:", err.message);
                uploadUrl = `/uploads/${uniqueKey}`;
            }
        }
        else if (process.env.BLOB_READ_WRITE_TOKEN) {
            uploadUrl = `https://blob.vercel-storage.com/${uniqueKey}`;
        }
        else {
            uploadUrl = `/uploads/${uniqueKey}`;
        }
        return {
            uploadUrl,
            fileKey: uniqueKey,
            publicUrl,
            maxSizeBytes: MAX_BYTES,
            allowedTypes: ALLOWED_MIME_TYPES,
        };
    }
    /**
     * Retrieve a file stream from Cloudflare R2 (or null if not found or R2 not configured).
     */
    static async getFile(fileKey) {
        const s3 = this.getS3Client();
        const r2Config = this.getR2Config();
        if (!s3 || !r2Config.bucket) {
            return null;
        }
        try {
            const response = await s3.send(new GetObjectCommand({
                Bucket: r2Config.bucket,
                Key: fileKey,
            }));
            return {
                stream: response.Body,
                contentType: response.ContentType,
                contentLength: response.ContentLength,
            };
        }
        catch {
            return null;
        }
    }
    /**
     * Delete a file from Cloudflare R2 and/or local storage.
     */
    static async deleteFile(fileKey) {
        let deleted = false;
        const s3 = this.getS3Client();
        const r2Config = this.getR2Config();
        if (s3 && r2Config.bucket) {
            try {
                await s3.send(new DeleteObjectCommand({
                    Bucket: r2Config.bucket,
                    Key: fileKey,
                }));
                deleted = true;
            }
            catch (err) {
                console.error(`Failed to delete file from R2 (${fileKey}):`, err.message);
            }
        }
        const localFilePath = path.join(process.cwd(), "uploads", fileKey);
        if (fs.existsSync(localFilePath)) {
            try {
                await fs.promises.unlink(localFilePath);
                deleted = true;
            }
            catch {
                // ignore
            }
        }
        return deleted;
    }
}
//# sourceMappingURL=upload.service.js.map
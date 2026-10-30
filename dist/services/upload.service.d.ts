import { S3Client } from "@aws-sdk/client-s3";
export interface UploadResult {
    url: string;
    fileKey: string;
    sizeBytes: number;
    contentType: string;
}
export interface R2Config {
    endpoint: string;
    bucket: string;
    accountId?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    publicUrl?: string;
}
export declare class UploadService {
    /**
     * Resolve Cloudflare R2 configuration from environment variables.
     * Supports R2_URL (e.g. https://002a043468f0003307e86563ada4b83e.r2.cloudflarestorage.com/catoza)
     * or explicit individual env vars.
     */
    static getR2Config(): R2Config;
    /**
     * Instantiate or return cached S3Client configured for Cloudflare R2.
     * Uses forcePathStyle: true so that S3 endpoints like:
     * https://<account_id>.r2.cloudflarestorage.com/<bucket>/<key> work as expected.
     */
    static getS3Client(): S3Client | null;
    /**
     * Format public access URL for a stored key.
     */
    static resolvePublicUrl(fileKey: string): string;
    /**
     * Save a base64 or raw image buffer either to Cloudflare R2 (when credentials provided),
     * Vercel Blob (fallback), or local disk under ./uploads/ (dev fallback).
     */
    static saveImage(options: {
        base64Data: string;
        type: "receipts" | "avatars";
        filename?: string;
        contentType?: string;
    }): Promise<UploadResult>;
    /**
     * Generates a pre-signed or direct upload metadata descriptor for clients.
     * If Cloudflare R2 is configured with credentials, generates an S3 pre-signed PUT URL.
     */
    static getUploadMetadata(options: {
        type: "receipts" | "avatars";
        filename?: string;
        contentType?: string;
        sizeBytes?: number;
    }): Promise<{
        uploadUrl: string;
        fileKey: string;
        publicUrl: string;
        maxSizeBytes: number;
        allowedTypes: string[];
    }>;
    /**
     * Retrieve a file stream from Cloudflare R2 (or null if not found or R2 not configured).
     */
    static getFile(fileKey: string): Promise<{
        stream: any;
        contentType?: string;
        contentLength?: number;
    } | null>;
    /**
     * Delete a file from Cloudflare R2 and/or local storage.
     */
    static deleteFile(fileKey: string): Promise<boolean>;
}

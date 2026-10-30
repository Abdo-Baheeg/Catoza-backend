export interface UploadResult {
    url: string;
    fileKey: string;
    sizeBytes: number;
    contentType: string;
}
export declare class UploadService {
    /**
     * Save a base64 or raw image buffer either to Vercel Blob (in production)
     * or to local disk under ./uploads/ (in development/fallback).
     */
    static saveImage(options: {
        base64Data: string;
        type: "receipts" | "avatars";
        filename?: string;
        contentType?: string;
    }): Promise<UploadResult>;
    /**
     * Generates a pre-signed or direct upload metadata descriptor for clients.
     */
    static getUploadMetadata(options: {
        type: "receipts" | "avatars";
        filename?: string;
        contentType?: string;
        sizeBytes?: number;
    }): {
        uploadUrl: string;
        fileKey: string;
        maxSizeBytes: number;
        allowedTypes: string[];
    };
}

import { Request, Response, NextFunction } from "express";
export declare class ApiError extends Error {
    statusCode: number;
    code: string;
    details?: unknown | undefined;
    constructor(statusCode: number, code: string, message: string, details?: unknown | undefined);
    static badRequest(message: string, code?: string, details?: unknown): ApiError;
    static unauthorized(message?: string, code?: string): ApiError;
    static forbidden(message?: string, code?: string): ApiError;
    static notFound(message?: string, code?: string): ApiError;
    static conflict(message: string, code?: string, details?: unknown): ApiError;
    static internal(message?: string, code?: string): ApiError;
}
export declare function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): Response<any, Record<string, any>>;

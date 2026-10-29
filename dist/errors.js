import { ZodError } from "zod";
export class ApiError extends Error {
    statusCode;
    code;
    details;
    constructor(statusCode, code, message, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.name = "ApiError";
    }
    static badRequest(message, code = "BAD_REQUEST", details) {
        return new ApiError(400, code, message, details);
    }
    static unauthorized(message = "Unauthorized", code = "UNAUTHORIZED") {
        return new ApiError(401, code, message);
    }
    static forbidden(message = "Forbidden", code = "FORBIDDEN") {
        return new ApiError(403, code, message);
    }
    static notFound(message = "Resource not found", code = "NOT_FOUND") {
        return new ApiError(404, code, message);
    }
    static conflict(message, code = "CONFLICT", details) {
        return new ApiError(409, code, message, details);
    }
    static internal(message = "Internal server error", code = "INTERNAL_ERROR") {
        return new ApiError(500, code, message);
    }
}
export function errorHandler(err, _req, res, _next) {
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            code: err.code,
            message: err.message,
            details: err.details,
        });
    }
    if (err instanceof ZodError) {
        return res.status(400).json({
            code: "VALIDATION_ERROR",
            message: "Invalid input data",
            details: err.flatten(),
        });
    }
    console.error("Unhandled error:", err);
    return res.status(500).json({
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
    });
}
//# sourceMappingURL=errors.js.map
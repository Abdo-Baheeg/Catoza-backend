import { Request, Response, NextFunction } from "express";
export interface AuthenticatedUser {
    id: string;
    email: string;
}
export interface HouseholdMembershipInfo {
    id: string;
    householdId: string;
    role: "admin" | "member";
    status: "active" | "away" | "left";
}
declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
            membership?: HouseholdMembershipInfo;
        }
    }
}
export declare function requireAuth(req: Request, _res: Response, next: NextFunction): void;
export declare function requireHouseholdMember(paramName?: string): (req: Request, _res: Response, next: NextFunction) => Promise<void>;
export declare function requireHouseholdAdmin(req: Request, _res: Response, next: NextFunction): void;
export declare function requireCronSecret(req: Request, _res: Response, next: NextFunction): void;

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "../errors.js";
import { db, memberships } from "../db/index.js";
import { and, eq } from "drizzle-orm";

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

const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret_dev";
const CRON_SECRET = process.env.CRON_SECRET || "default_cron_secret_dev";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(ApiError.unauthorized("Authentication token required"));
  }

  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    req.user = { id: payload.id, email: payload.email };
    next();
  } catch (err) {
    return next(ApiError.unauthorized("Invalid or expired token"));
  }
}

export function requireHouseholdMember(paramName = "householdId") {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }

    const householdId =
      req.params[paramName] || req.body[paramName] || (req.query[paramName] as string);

    if (!householdId) {
      return next(ApiError.badRequest("Household ID is required", "MISSING_HOUSEHOLD_ID"));
    }

    try {
      const [membership] = await db
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.householdId, householdId),
            eq(memberships.userId, req.user.id)
          )
        )
        .limit(1);

      if (!membership || membership.status === "left") {
        return next(
          ApiError.forbidden("You are not an active member of this household", "NOT_A_MEMBER")
        );
      }

      req.membership = {
        id: membership.id,
        householdId: membership.householdId,
        role: membership.role as "admin" | "member",
        status: membership.status as "active" | "away" | "left",
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireHouseholdAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.membership || req.membership.role !== "admin") {
    return next(
      ApiError.forbidden("Household admin privileges required", "ADMIN_REQUIRED")
    );
  }
  next();
}

export function requireCronSecret(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const secretHeader = req.headers["x-cron-secret"];

  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7)
    : secretHeader;

  if (!token || token !== CRON_SECRET) {
    return next(ApiError.unauthorized("Unauthorized cron trigger"));
  }

  next();
}

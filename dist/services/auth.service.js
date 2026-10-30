import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { db, users, sessions } from "../db/index.js";
import { eq, and, gt } from "drizzle-orm";
import { ApiError } from "../errors.js";
const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret_dev";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "default_jwt_refresh_secret_dev";
const ACCESS_EXPIRES_IN = "15m";
const REFRESH_EXPIRES_DAYS = 30;
function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}
export class AuthService {
    static async register(data) {
        const existing = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, data.email.toLowerCase()))
            .limit(1);
        if (existing.length > 0) {
            throw ApiError.conflict("Email is already registered", "EMAIL_EXISTS");
        }
        if (data.password.length < 8) {
            throw ApiError.badRequest("Password must be at least 8 characters long", "WEAK_PASSWORD");
        }
        const passwordHash = await bcrypt.hash(data.password, 10);
        const [user] = await db
            .insert(users)
            .values({
            email: data.email.toLowerCase(),
            displayName: data.displayName,
            passwordHash,
            avatarUrl: data.avatarUrl,
            instapayLink: data.instapayLink,
            instapayUsername: data.instapayUsername,
        })
            .returning({
            id: users.id,
            email: users.email,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
            instapayLink: users.instapayLink,
            instapayUsername: users.instapayUsername,
            createdAt: users.createdAt,
        });
        const tokens = await this.generateTokens(user.id, user.email);
        return { user, tokens };
    }
    static async login(data) {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, data.email.toLowerCase()))
            .limit(1);
        if (!user) {
            throw ApiError.unauthorized("Invalid email or password");
        }
        const match = await bcrypt.compare(data.password, user.passwordHash);
        if (!match) {
            throw ApiError.unauthorized("Invalid email or password");
        }
        const tokens = await this.generateTokens(user.id, user.email, data.deviceName);
        return {
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                createdAt: user.createdAt,
            },
            tokens,
        };
    }
    static async refresh(refreshToken) {
        let payload;
        try {
            payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        }
        catch {
            throw ApiError.unauthorized("Invalid or expired refresh token", "INVALID_REFRESH_TOKEN");
        }
        const tokenHash = hashToken(refreshToken);
        const [session] = await db
            .select()
            .from(sessions)
            .where(and(eq(sessions.userId, payload.id), eq(sessions.refreshTokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
            .limit(1);
        if (!session || session.revokedAt) {
            throw ApiError.unauthorized("Refresh token revoked or expired", "REVOKED_SESSION");
        }
        // Revoke old session (rotating refresh token)
        await db
            .update(sessions)
            .set({ revokedAt: new Date() })
            .where(eq(sessions.id, session.id));
        // Generate new pair
        return await this.generateTokens(payload.id, payload.email, session.deviceName || undefined);
    }
    static async logout(refreshToken) {
        const tokenHash = hashToken(refreshToken);
        await db
            .update(sessions)
            .set({ revokedAt: new Date() })
            .where(eq(sessions.refreshTokenHash, tokenHash));
    }
    static async getMe(userId) {
        const [user] = await db
            .select({
            id: users.id,
            email: users.email,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
            instapayLink: users.instapayLink,
            instapayUsername: users.instapayUsername,
            createdAt: users.createdAt,
        })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
        if (!user) {
            throw ApiError.notFound("User not found");
        }
        return user;
    }
    static async updateProfile(userId, data) {
        const updateData = {
            updatedAt: new Date(),
        };
        if (data.displayName !== undefined)
            updateData.displayName = data.displayName;
        if (data.avatarUrl !== undefined)
            updateData.avatarUrl = data.avatarUrl;
        if (data.instapayLink !== undefined)
            updateData.instapayLink = data.instapayLink;
        if (data.instapayUsername !== undefined)
            updateData.instapayUsername = data.instapayUsername;
        const [updated] = await db
            .update(users)
            .set(updateData)
            .where(eq(users.id, userId))
            .returning({
            id: users.id,
            email: users.email,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
            instapayLink: users.instapayLink,
            instapayUsername: users.instapayUsername,
            updatedAt: users.updatedAt,
        });
        if (!updated) {
            throw ApiError.notFound("User not found");
        }
        return updated;
    }
    static async generateTokens(userId, email, deviceName) {
        const accessToken = jwt.sign({ id: userId, email }, JWT_SECRET, {
            expiresIn: ACCESS_EXPIRES_IN,
        });
        const refreshTokenRaw = crypto.randomBytes(32).toString("hex");
        const refreshToken = jwt.sign({ id: userId, email, raw: refreshTokenRaw }, JWT_REFRESH_SECRET, {
            expiresIn: `${REFRESH_EXPIRES_DAYS}d`,
        });
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRES_DAYS);
        await db.insert(sessions).values({
            userId,
            refreshTokenHash: hashToken(refreshToken),
            deviceName: deviceName || null,
            expiresAt,
        });
        return {
            accessToken,
            refreshToken,
            expiresIn: 15 * 60, // seconds
        };
    }
}
//# sourceMappingURL=auth.service.js.map
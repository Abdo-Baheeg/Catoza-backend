import crypto from "crypto";
import { db, households, memberships, users, changeLog } from "../db/index.js";
import { eq, and } from "drizzle-orm";
import { ApiError } from "../errors.js";

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase(); // e.g. "A3F8B2C1"
}

function hashInviteCode(code: string): string {
  return crypto.createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

export class HouseholdService {
  static async createHousehold(userId: string, data: { name: string; currency?: string; timezone?: string }) {
    const inviteCode = generateInviteCode();
    const inviteCodeHash = hashInviteCode(inviteCode);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14); // 14 days valid

    const [household] = await db
      .insert(households)
      .values({
        name: data.name,
        currency: data.currency || "EGP",
        timezone: data.timezone || "Africa/Cairo",
        inviteCodeHash,
        inviteCodeExpiresAt: expiresAt,
        createdBy: userId,
      })
      .returning();

    const [membership] = await db
      .insert(memberships)
      .values({
        householdId: household.id,
        userId,
        role: "admin",
        status: "active",
      })
      .returning();

    // Append to change_log
    await db.insert(changeLog).values({
      householdId: household.id,
      entityType: "household",
      entityId: household.id,
      op: "upsert",
      version: household.version,
    });

    return {
      household,
      membership,
      inviteCode, // Returned only upon creation or regeneration
    };
  }

  static async joinByInviteCode(userId: string, inviteCode: string) {
    const codeHash = hashInviteCode(inviteCode);

    const [household] = await db
      .select()
      .from(households)
      .where(eq(households.inviteCodeHash, codeHash))
      .limit(1);

    if (!household) {
      throw ApiError.badRequest("Invalid invite code", "INVALID_INVITE_CODE");
    }

    if (household.inviteCodeExpiresAt && household.inviteCodeExpiresAt < new Date()) {
      throw ApiError.badRequest("Invite code has expired", "INVITE_CODE_EXPIRED");
    }

    // Check if user is already a member
    const [existingMembership] = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.householdId, household.id),
          eq(memberships.userId, userId)
        )
      )
      .limit(1);

    if (existingMembership) {
      if (existingMembership.status === "left") {
        const [updated] = await db
          .update(memberships)
          .set({ status: "active", updatedAt: new Date(), version: existingMembership.version + 1 })
          .where(eq(memberships.id, existingMembership.id))
          .returning();

        await db.insert(changeLog).values({
          householdId: household.id,
          entityType: "membership",
          entityId: updated.id,
          op: "upsert",
          version: updated.version,
        });

        return { household, membership: updated };
      }
      throw ApiError.conflict("You are already a member of this household", "ALREADY_MEMBER");
    }

    const [newMembership] = await db
      .insert(memberships)
      .values({
        householdId: household.id,
        userId,
        role: "member",
        status: "active",
      })
      .returning();

    await db.insert(changeLog).values({
      householdId: household.id,
      entityType: "membership",
      entityId: newMembership.id,
      op: "upsert",
      version: newMembership.version,
    });

    return { household, membership: newMembership };
  }

  static async generateNewInviteCode(householdId: string) {
    const inviteCode = generateInviteCode();
    const inviteCodeHash = hashInviteCode(inviteCode);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    await db
      .update(households)
      .set({
        inviteCodeHash,
        inviteCodeExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(households.id, householdId));

    return { inviteCode, expiresAt };
  }

  static async listMembers(householdId: string) {
    const rows = await db
      .select({
        membershipId: memberships.id,
        role: memberships.role,
        status: memberships.status,
        joinedAt: memberships.joinedAt,
        userId: users.id,
        displayName: users.displayName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.householdId, householdId));

    return rows;
  }

  static async updateMembership(
    membershipId: string,
    data: { role?: "admin" | "member"; status?: "active" | "away" | "left" }
  ) {
    const [existing] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.id, membershipId))
      .limit(1);

    if (!existing) {
      throw ApiError.notFound("Membership not found");
    }

    const [updated] = await db
      .update(memberships)
      .set({
        ...(data.role && { role: data.role }),
        ...(data.status && { status: data.status }),
        version: existing.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(memberships.id, membershipId))
      .returning();

    await db.insert(changeLog).values({
      householdId: existing.householdId,
      entityType: "membership",
      entityId: updated.id,
      op: "upsert",
      version: updated.version,
    });

    return updated;
  }

  static async getUserHouseholds(userId: string) {
    const rows = await db
      .select({
        household: households,
        role: memberships.role,
        status: memberships.status,
      })
      .from(memberships)
      .innerJoin(households, eq(memberships.householdId, households.id))
      .where(eq(memberships.userId, userId));

    return rows;
  }
}

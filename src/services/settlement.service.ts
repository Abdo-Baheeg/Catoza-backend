import { db, settlements, changeLog, users } from "../db/index.js";
import { eq, and, desc } from "drizzle-orm";
import { ApiError } from "../errors.js";

export class SettlementService {
  static async createSettlement(input: {
    householdId: string;
    fromUser: string;
    toUser: string;
    amountMinor: bigint | number | string;
    currency?: string;
    createdBy: string;
  }) {
    if (input.fromUser === input.toUser) {
      throw ApiError.badRequest("Cannot settle with yourself", "SELF_SETTLEMENT");
    }

    const amount = BigInt(input.amountMinor);
    if (amount <= 0n) {
      throw ApiError.badRequest("Settlement amount must be positive", "INVALID_AMOUNT");
    }

    const [settlement] = await db
      .insert(settlements)
      .values({
        householdId: input.householdId,
        fromUser: input.fromUser,
        toUser: input.toUser,
        amountMinor: amount,
        currency: input.currency || "EGP",
        status: "pending",
        createdBy: input.createdBy,
        version: 1,
      })
      .returning();

    await db.insert(changeLog).values({
      householdId: input.householdId,
      entityType: "settlement",
      entityId: settlement.id,
      op: "upsert",
      version: settlement.version,
    });

    return settlement;
  }

  static async confirmSettlement(settlementId: string, actorId: string) {
    const [existing] = await db
      .select()
      .from(settlements)
      .where(eq(settlements.id, settlementId))
      .limit(1);

    if (!existing) {
      throw ApiError.notFound("Settlement not found");
    }

    // Money Rule: Only the recipient can confirm the receipt of a settlement!
    if (existing.toUser !== actorId) {
      throw ApiError.forbidden(
        "Only the recipient of a payment can confirm its receipt",
        "NOT_RECIPIENT"
      );
    }

    if (existing.status === "confirmed") {
      return existing; // Idempotent
    }

    const [updated] = await db
      .update(settlements)
      .set({
        status: "confirmed",
        confirmedBy: actorId,
        confirmedAt: new Date(),
        version: existing.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(settlements.id, settlementId))
      .returning();

    await db.insert(changeLog).values({
      householdId: existing.householdId,
      entityType: "settlement",
      entityId: settlementId,
      op: "upsert",
      version: updated.version,
    });

    return updated;
  }

  static async rejectSettlement(settlementId: string, actorId: string) {
    const [existing] = await db
      .select()
      .from(settlements)
      .where(eq(settlements.id, settlementId))
      .limit(1);

    if (!existing) {
      throw ApiError.notFound("Settlement not found");
    }

    if (existing.toUser !== actorId && existing.fromUser !== actorId) {
      throw ApiError.forbidden("You are not a party to this settlement", "NOT_PARTY");
    }

    const [updated] = await db
      .update(settlements)
      .set({
        status: "rejected",
        version: existing.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(settlements.id, settlementId))
      .returning();

    await db.insert(changeLog).values({
      householdId: existing.householdId,
      entityType: "settlement",
      entityId: settlementId,
      op: "upsert",
      version: updated.version,
    });

    return updated;
  }

  static async listSettlements(householdId: string) {
    const rows = await db
      .select({
        id: settlements.id,
        amountMinor: settlements.amountMinor,
        currency: settlements.currency,
        status: settlements.status,
        createdAt: settlements.createdAt,
        confirmedAt: settlements.confirmedAt,
        version: settlements.version,
        fromUserId: settlements.fromUser,
        fromUserName: users.displayName,
        toUserId: settlements.toUser,
      })
      .from(settlements)
      .innerJoin(users, eq(settlements.fromUser, users.id))
      .where(eq(settlements.householdId, householdId))
      .orderBy(desc(settlements.createdAt));

    return rows;
  }
}

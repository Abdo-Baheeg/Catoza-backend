import {
  db,
  expenses,
  expenseShares,
  expenseEvents,
  expenseComments,
  changeLog,
  users,
} from "../db/index.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { ApiError } from "../errors.js";
import {
  calculateShares,
  ParticipantShareInput,
  SplitMethod,
} from "../domain/index.js";

export interface CreateExpenseInput {
  householdId: string;
  payerId: string;
  createdBy: string;
  title: string;
  notes?: string;
  amountMinor: bigint | number | string;
  currency?: string;
  category?: string;
  expenseDate?: Date | string;
  splitMethod: SplitMethod;
  participants: ParticipantShareInput[];
  receiptUrl?: string;
}

export class ExpenseService {
  static async createExpense(input: CreateExpenseInput) {
    const totalAmount = BigInt(input.amountMinor);
    const shares = calculateShares(totalAmount, input.splitMethod, input.participants);

    return await db.transaction(async (tx) => {
      // 1. Insert expense
      const [expense] = await tx
        .insert(expenses)
        .values({
          householdId: input.householdId,
          payerId: input.payerId,
          createdBy: input.createdBy,
          title: input.title,
          notes: input.notes,
          amountMinor: totalAmount,
          currency: input.currency || "EGP",
          category: input.category || "general",
          expenseDate: input.expenseDate ? new Date(input.expenseDate) : new Date(),
          splitMethod: input.splitMethod,
          status: "active",
          version: 1,
          receiptUrl: input.receiptUrl,
        })
        .returning();

      // 2. Insert shares
      await tx.insert(expenseShares).values(
        shares.map((s) => ({
          expenseId: expense.id,
          userId: s.userId,
          shareMinor: s.shareMinor,
          splitValue: input.participants.find((p) => p.userId === s.userId)?.shares || null,
        }))
      );

      // 3. Append to audit trail
      await tx.insert(expenseEvents).values({
        expenseId: expense.id,
        type: "created",
        actorId: input.createdBy,
        diffJson: {
          title: expense.title,
          amountMinor: expense.amountMinor.toString(),
          splitMethod: expense.splitMethod,
          shares: shares.map((s) => ({
            userId: s.userId,
            shareMinor: s.shareMinor.toString(),
          })),
        },
      });

      // 4. Append to change_log
      await tx.insert(changeLog).values({
        householdId: input.householdId,
        entityType: "expense",
        entityId: expense.id,
        op: "upsert",
        version: expense.version,
      });

      return {
        ...expense,
        shares,
      };
    });
  }

  static async getExpense(expenseId: string) {
    const [expense] = await db
      .select()
      .from(expenses)
      .where(eq(expenses.id, expenseId))
      .limit(1);

    if (!expense || expense.deletedAt) {
      throw ApiError.notFound("Expense not found");
    }

    const shares = await db
      .select({
        userId: expenseShares.userId,
        shareMinor: expenseShares.shareMinor,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(expenseShares)
      .innerJoin(users, eq(expenseShares.userId, users.id))
      .where(eq(expenseShares.expenseId, expenseId));

    const events = await db
      .select({
        id: expenseEvents.id,
        type: expenseEvents.type,
        actorId: expenseEvents.actorId,
        actorName: users.displayName,
        diffJson: expenseEvents.diffJson,
        createdAt: expenseEvents.createdAt,
      })
      .from(expenseEvents)
      .innerJoin(users, eq(expenseEvents.actorId, users.id))
      .where(eq(expenseEvents.expenseId, expenseId))
      .orderBy(desc(expenseEvents.createdAt));

    const comments = await db
      .select({
        id: expenseComments.id,
        body: expenseComments.body,
        createdAt: expenseComments.createdAt,
        authorId: expenseComments.authorId,
        authorName: users.displayName,
        authorAvatar: users.avatarUrl,
      })
      .from(expenseComments)
      .innerJoin(users, eq(expenseComments.authorId, users.id))
      .where(
        and(
          eq(expenseComments.expenseId, expenseId),
          sql`${expenseComments.deletedAt} IS NULL`
        )
      )
      .orderBy(expenseComments.createdAt);

    return {
      ...expense,
      shares,
      events,
      comments,
    };
  }

  static async listExpenses(
    householdId: string,
    options: {
      category?: string;
      status?: "active" | "cancelled" | "disputed";
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const query = db
      .select({
        id: expenses.id,
        title: expenses.title,
        amountMinor: expenses.amountMinor,
        currency: expenses.currency,
        category: expenses.category,
        expenseDate: expenses.expenseDate,
        splitMethod: expenses.splitMethod,
        status: expenses.status,
        receiptUrl: expenses.receiptUrl,
        version: expenses.version,
        createdAt: expenses.createdAt,
        payerId: expenses.payerId,
        payerName: users.displayName,
      })
      .from(expenses)
      .innerJoin(users, eq(expenses.payerId, users.id))
      .where(
        and(
          eq(expenses.householdId, householdId),
          sql`${expenses.deletedAt} IS NULL`,
          options.category ? eq(expenses.category, options.category) : undefined,
          options.status ? eq(expenses.status, options.status) : undefined
        )
      )
      .orderBy(desc(expenses.expenseDate))
      .limit(limit)
      .offset(offset);

    return await query;
  }

  static async updateExpense(
    expenseId: string,
    actorId: string,
    data: {
      title?: string;
      notes?: string;
      amountMinor?: bigint | number | string;
      category?: string;
      expenseDate?: Date | string;
      splitMethod?: SplitMethod;
      participants?: ParticipantShareInput[];
      receiptUrl?: string;
      baseVersion: number;
    }
  ) {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(expenses)
        .where(eq(expenses.id, expenseId))
        .limit(1);

      if (!existing || existing.deletedAt) {
        throw ApiError.notFound("Expense not found");
      }

      // Concurrency check
      if (existing.version !== data.baseVersion) {
        throw ApiError.conflict(
          `Version conflict: existing version is ${existing.version}, base was ${data.baseVersion}`,
          "VERSION_CONFLICT",
          { currentVersion: existing.version }
        );
      }

      const newAmount = data.amountMinor !== undefined ? BigInt(data.amountMinor) : existing.amountMinor;
      const newMethod = data.splitMethod || (existing.splitMethod as SplitMethod);

      const updatedFields: Record<string, unknown> = {
        version: existing.version + 1,
        updatedAt: new Date(),
      };

      if (data.title !== undefined) updatedFields.title = data.title;
      if (data.notes !== undefined) updatedFields.notes = data.notes;
      if (data.amountMinor !== undefined) updatedFields.amountMinor = newAmount;
      if (data.category !== undefined) updatedFields.category = data.category;
      if (data.expenseDate !== undefined) updatedFields.expenseDate = new Date(data.expenseDate);
      if (data.splitMethod !== undefined) updatedFields.splitMethod = newMethod;
      if (data.receiptUrl !== undefined) updatedFields.receiptUrl = data.receiptUrl;

      const [updated] = await tx
        .update(expenses)
        .set(updatedFields)
        .where(eq(expenses.id, expenseId))
        .returning();

      // Recalculate shares if amount, splitMethod, or participants changed
      if (data.participants || data.amountMinor !== undefined || data.splitMethod !== undefined) {
        let participantsToUse: ParticipantShareInput[] = data.participants || [];

        if (!data.participants) {
          const currentShares = await tx
            .select()
            .from(expenseShares)
            .where(eq(expenseShares.expenseId, expenseId));

          participantsToUse = currentShares.map((s) => ({
            userId: s.userId,
            shares: s.splitValue ? Number(s.splitValue) : undefined,
          }));
        }

        const newShares = calculateShares(newAmount, newMethod, participantsToUse);

        // Delete existing and reinsert
        await tx.delete(expenseShares).where(eq(expenseShares.expenseId, expenseId));
        await tx.insert(expenseShares).values(
          newShares.map((s) => ({
            expenseId,
            userId: s.userId,
            shareMinor: s.shareMinor,
            splitValue: participantsToUse.find((p) => p.userId === s.userId)?.shares || null,
          }))
        );
      }

      // Record audit diff
      await tx.insert(expenseEvents).values({
        expenseId,
        type: "edited",
        actorId,
        diffJson: {
          previousVersion: existing.version,
          changes: data,
        },
      });

      // Append to change_log
      await tx.insert(changeLog).values({
        householdId: existing.householdId,
        entityType: "expense",
        entityId: expenseId,
        op: "upsert",
        version: updated.version,
      });

      return updated;
    });
  }

  static async cancelExpense(expenseId: string, actorId: string) {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(expenses)
        .where(eq(expenses.id, expenseId))
        .limit(1);

      if (!existing || existing.deletedAt) {
        throw ApiError.notFound("Expense not found");
      }

      if (existing.status === "cancelled") {
        return existing;
      }

      const [updated] = await tx
        .update(expenses)
        .set({
          status: "cancelled",
          version: existing.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(expenses.id, expenseId))
        .returning();

      await tx.insert(expenseEvents).values({
        expenseId,
        type: "cancelled",
        actorId,
      });

      await tx.insert(changeLog).values({
        householdId: existing.householdId,
        entityType: "expense",
        entityId: expenseId,
        op: "upsert",
        version: updated.version,
      });

      return updated;
    });
  }

  static async disputeExpense(expenseId: string, actorId: string, reason?: string) {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(expenses)
        .where(eq(expenses.id, expenseId))
        .limit(1);

      if (!existing || existing.deletedAt) {
        throw ApiError.notFound("Expense not found");
      }

      const [updated] = await tx
        .update(expenses)
        .set({
          status: "disputed",
          version: existing.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(expenses.id, expenseId))
        .returning();

      await tx.insert(expenseEvents).values({
        expenseId,
        type: "disputed",
        actorId,
        diffJson: { reason },
      });

      await tx.insert(changeLog).values({
        householdId: existing.householdId,
        entityType: "expense",
        entityId: expenseId,
        op: "upsert",
        version: updated.version,
      });

      return updated;
    });
  }

  static async addComment(expenseId: string, authorId: string, body: string) {
    const [comment] = await db
      .insert(expenseComments)
      .values({
        expenseId,
        authorId,
        body,
      })
      .returning();

    return comment;
  }
}

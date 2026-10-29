import {
  db,
  recurringTemplates,
  expenses,
  expenseShares,
  changeLog,
  syncOperations,
} from "../db/index.js";
import { eq, and, lte, sql } from "drizzle-orm";
import { calculateShares, ParticipantShareInput, SplitMethod } from "../domain/index.js";

export class InternalService {
  static async runDailySweep() {
    const results = {
      recurringProcessed: 0,
      syncOperationsPruned: 0,
      changeLogPruned: 0,
    };

    const now = new Date();

    // 1. Recurring templates due today
    const dueTemplates = await db
      .select()
      .from(recurringTemplates)
      .where(
        and(
          eq(recurringTemplates.active, true),
          lte(recurringTemplates.nextRunOn, now)
        )
      );

    for (const t of dueTemplates) {
      await db.transaction(async (tx) => {
        const participants = (t.participantsJson as ParticipantShareInput[]) || [];
        const shares = calculateShares(
          t.amountMinor,
          t.splitMethod as SplitMethod,
          participants
        );

        const [exp] = await tx
          .insert(expenses)
          .values({
            householdId: t.householdId,
            payerId: t.payerId,
            createdBy: t.payerId,
            title: t.title,
            amountMinor: t.amountMinor,
            currency: t.currency,
            category: t.category,
            expenseDate: now,
            splitMethod: t.splitMethod,
            status: "active",
            version: 1,
          })
          .returning();

        await tx.insert(expenseShares).values(
          shares.map((s) => ({
            expenseId: exp.id,
            userId: s.userId,
            shareMinor: s.shareMinor,
          }))
        );

        await tx.insert(changeLog).values({
          householdId: t.householdId,
          entityType: "expense",
          entityId: exp.id,
          op: "upsert",
          version: exp.version,
        });

        // Advance next_run_on by 1 month (or based on rrule)
        const nextMonth = new Date(t.nextRunOn);
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        await tx
          .update(recurringTemplates)
          .set({ nextRunOn: nextMonth, updatedAt: now })
          .where(eq(recurringTemplates.id, t.id));

        results.recurringProcessed++;
      });
    }

    // 2. Prune sync_operations older than 30 days (Section 15.2 Database limits)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const prunedSync = await db
      .delete(syncOperations)
      .where(sql`${syncOperations.processedAt} < ${thirtyDaysAgo}`)
      .returning({ id: syncOperations.operationId });

    results.syncOperationsPruned = prunedSync.length;

    // 3. Prune change_log older than 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const prunedChange = await db
      .delete(changeLog)
      .where(sql`${changeLog.createdAt} < ${ninetyDaysAgo}`)
      .returning({ seq: changeLog.seq });

    results.changeLogPruned = prunedChange.length;

    return results;
  }
}

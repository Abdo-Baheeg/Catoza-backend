import {
  db,
  notes,
  noteReads,
  chores,
  choreAssignments,
  shoppingItems,
  polls,
  pollOptions,
  pollVotes,
  awayPeriods,
  changeLog,
  users,
} from "../db/index.js";
import { eq, and, or, sql, desc } from "drizzle-orm";
import { ApiError } from "../errors.js";
import { ExpenseService } from "./expense.service.js";

export class HouseholdLifeService {
  // === NOTES ===
  static async createNote(input: {
    householdId: string;
    authorId: string;
    recipientId?: string;
    title?: string;
    body: string;
    pinned?: boolean;
    visibility?: "all" | "private";
  }) {
    const [note] = await db
      .insert(notes)
      .values({
        householdId: input.householdId,
        authorId: input.authorId,
        recipientId: input.recipientId || null,
        title: input.title,
        body: input.body,
        pinned: input.pinned || false,
        visibility: input.recipientId ? "private" : input.visibility || "all",
        version: 1,
      })
      .returning();

    await db.insert(changeLog).values({
      householdId: input.householdId,
      entityType: "note",
      entityId: note.id,
      op: "upsert",
      version: note.version,
    });

    return note;
  }

  static async listNotes(householdId: string, currentUserId: string) {
    // Security / privacy rule from Section 10: Private notes filtered server-side!
    const rows = await db
      .select({
        id: notes.id,
        title: notes.title,
        body: notes.body,
        pinned: notes.pinned,
        visibility: notes.visibility,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
        version: notes.version,
        authorId: notes.authorId,
        authorName: users.displayName,
        recipientId: notes.recipientId,
      })
      .from(notes)
      .innerJoin(users, eq(notes.authorId, users.id))
      .where(
        and(
          eq(notes.householdId, householdId),
          sql`${notes.deletedAt} IS NULL`,
          or(
            eq(notes.visibility, "all"),
            eq(notes.authorId, currentUserId),
            eq(notes.recipientId, currentUserId)
          )
        )
      )
      .orderBy(desc(notes.pinned), desc(notes.createdAt));

    return rows;
  }

  static async markNoteAsRead(noteId: string, userId: string) {
    await db
      .insert(noteReads)
      .values({ noteId, userId })
      .onConflictDoNothing();

    return { success: true };
  }

  static async deleteNote(noteId: string, userId: string) {
    const [existing] = await db.select().from(notes).where(eq(notes.id, noteId)).limit(1);
    if (!existing || existing.deletedAt) {
      throw ApiError.notFound("Note not found");
    }

    const [deleted] = await db
      .update(notes)
      .set({ deletedAt: new Date(), version: existing.version + 1 })
      .where(eq(notes.id, noteId))
      .returning();

    await db.insert(changeLog).values({
      householdId: existing.householdId,
      entityType: "note",
      entityId: noteId,
      op: "delete",
      version: deleted.version,
    });

    return { success: true };
  }

  // === CHORES ===
  static async createChore(input: {
    householdId: string;
    title: string;
    description?: string;
    rotationUserIds: string[];
    frequency?: string;
    firstDueOn?: Date | string;
  }) {
    return await db.transaction(async (tx) => {
      const [chore] = await tx
        .insert(chores)
        .values({
          householdId: input.householdId,
          title: input.title,
          description: input.description,
          rotationJson: input.rotationUserIds,
          frequency: input.frequency || "weekly",
          isActive: true,
          version: 1,
        })
        .returning();

      // Create initial assignment if rotation is provided
      if (input.rotationUserIds.length > 0) {
        const dueDate = input.firstDueOn ? new Date(input.firstDueOn) : new Date();
        if (!input.firstDueOn) {
          dueDate.setDate(dueDate.getDate() + 7);
        }

        await tx.insert(choreAssignments).values({
          choreId: chore.id,
          assigneeId: input.rotationUserIds[0],
          dueOn: dueDate,
          status: "pending",
          version: 1,
        });
      }

      await tx.insert(changeLog).values({
        householdId: input.householdId,
        entityType: "chore",
        entityId: chore.id,
        op: "upsert",
        version: chore.version,
      });

      return chore;
    });
  }

  static async listChores(householdId: string) {
    return await db
      .select()
      .from(chores)
      .where(and(eq(chores.householdId, householdId), eq(chores.isActive, true)));
  }

  static async listChoreAssignments(householdId: string) {
    const rows = await db
      .select({
        id: choreAssignments.id,
        choreId: chores.id,
        choreTitle: chores.title,
        assigneeId: users.id,
        assigneeName: users.displayName,
        dueOn: choreAssignments.dueOn,
        status: choreAssignments.status,
        completedAt: choreAssignments.completedAt,
        version: choreAssignments.version,
      })
      .from(choreAssignments)
      .innerJoin(chores, eq(choreAssignments.choreId, chores.id))
      .innerJoin(users, eq(choreAssignments.assigneeId, users.id))
      .where(eq(chores.householdId, householdId))
      .orderBy(choreAssignments.dueOn);

    return rows;
  }

  static async updateChoreAssignment(
    assignmentId: string,
    status: "completed" | "skipped",
    actorId: string
  ) {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(choreAssignments)
        .where(eq(choreAssignments.id, assignmentId))
        .limit(1);

      if (!existing) {
        throw ApiError.notFound("Chore assignment not found");
      }

      const [updated] = await tx
        .update(choreAssignments)
        .set({
          status,
          completedAt: status === "completed" ? new Date() : null,
          version: existing.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(choreAssignments.id, assignmentId))
        .returning();

      // Advance rotation: create next assignment
      const [chore] = await tx
        .select()
        .from(chores)
        .where(eq(chores.id, existing.choreId))
        .limit(1);

      if (chore && chore.isActive && Array.isArray(chore.rotationJson)) {
        const rotation = chore.rotationJson as string[];
        const currentIndex = rotation.indexOf(existing.assigneeId);
        const nextIndex = (currentIndex + 1) % rotation.length;
        const nextAssigneeId = rotation[nextIndex];

        const nextDue = new Date(existing.dueOn);
        nextDue.setDate(nextDue.getDate() + 7);

        await tx.insert(choreAssignments).values({
          choreId: chore.id,
          assigneeId: nextAssigneeId,
          dueOn: nextDue,
          status: "pending",
          version: 1,
        });
      }

      await tx.insert(changeLog).values({
        householdId: chore.householdId,
        entityType: "chore_assignment",
        entityId: assignmentId,
        op: "upsert",
        version: updated.version,
      });

      return updated;
    });
  }

  // === SHOPPING ITEMS ===
  static async addShoppingItem(input: {
    householdId: string;
    name: string;
    qty?: string;
    addedBy: string;
  }) {
    const [item] = await db
      .insert(shoppingItems)
      .values({
        householdId: input.householdId,
        name: input.name,
        qty: input.qty || "1",
        addedBy: input.addedBy,
        version: 1,
      })
      .returning();

    await db.insert(changeLog).values({
      householdId: input.householdId,
      entityType: "shopping_item",
      entityId: item.id,
      op: "upsert",
      version: item.version,
    });

    return item;
  }

  static async listShoppingItems(householdId: string) {
    return await db
      .select({
        id: shoppingItems.id,
        name: shoppingItems.name,
        qty: shoppingItems.qty,
        addedBy: shoppingItems.addedBy,
        addedByName: users.displayName,
        boughtBy: shoppingItems.boughtBy,
        boughtAt: shoppingItems.boughtAt,
        version: shoppingItems.version,
        createdAt: shoppingItems.createdAt,
      })
      .from(shoppingItems)
      .innerJoin(users, eq(shoppingItems.addedBy, users.id))
      .where(
        and(
          eq(shoppingItems.householdId, householdId),
          sql`${shoppingItems.deletedAt} IS NULL`
        )
      )
      .orderBy(shoppingItems.boughtAt, desc(shoppingItems.createdAt));
  }

  static async updateShoppingItem(
    itemId: string,
    data: { name?: string; qty?: string; isBought?: boolean; boughtBy?: string }
  ) {
    const [existing] = await db
      .select()
      .from(shoppingItems)
      .where(eq(shoppingItems.id, itemId))
      .limit(1);

    if (!existing || existing.deletedAt) {
      throw ApiError.notFound("Shopping item not found");
    }

    const updates: Record<string, unknown> = {
      version: existing.version + 1,
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updates.name = data.name;
    if (data.qty !== undefined) updates.qty = data.qty;
    if (data.isBought !== undefined) {
      updates.boughtBy = data.isBought ? data.boughtBy || null : null;
      updates.boughtAt = data.isBought ? new Date() : null;
    }

    const [updated] = await db
      .update(shoppingItems)
      .set(updates)
      .where(eq(shoppingItems.id, itemId))
      .returning();

    await db.insert(changeLog).values({
      householdId: existing.householdId,
      entityType: "shopping_item",
      entityId: itemId,
      op: "upsert",
      version: updated.version,
    });

    return updated;
  }

  static async convertShoppingItemsToExpense(input: {
    householdId: string;
    itemIds: string[];
    payerId: string;
    amountMinor: bigint | number | string;
    participantIds: string[];
  }) {
    // Spec feature: "Shopping list -> expense: Mark items bought, then one tap creates the expense"
    return await db.transaction(async (tx) => {
      // Create expense
      const expense = await ExpenseService.createExpense({
        householdId: input.householdId,
        payerId: input.payerId,
        createdBy: input.payerId,
        title: "Groceries (Shopping list items)",
        category: "groceries",
        amountMinor: input.amountMinor,
        splitMethod: "equal",
        participants: input.participantIds.map((id) => ({ userId: id })),
      });

      // Mark shopping items as bought and soft-delete/archive
      for (const id of input.itemIds) {
        await tx
          .update(shoppingItems)
          .set({
            boughtBy: input.payerId,
            boughtAt: new Date(),
            deletedAt: new Date(),
          })
          .where(eq(shoppingItems.id, id));
      }

      return expense;
    });
  }

  // === POLLS ===
  static async createPoll(input: {
    householdId: string;
    question: string;
    createdBy: string;
    options: string[];
    closesAt?: Date | string;
  }) {
    if (!input.options || input.options.length < 2) {
      throw ApiError.badRequest("Poll must have at least 2 options", "INVALID_OPTIONS");
    }

    return await db.transaction(async (tx) => {
      const [poll] = await tx
        .insert(polls)
        .values({
          householdId: input.householdId,
          question: input.question,
          createdBy: input.createdBy,
          closesAt: input.closesAt ? new Date(input.closesAt) : null,
          version: 1,
        })
        .returning();

      for (const optText of input.options) {
        await tx.insert(pollOptions).values({
          pollId: poll.id,
          optionText: optText,
        });
      }

      await tx.insert(changeLog).values({
        householdId: input.householdId,
        entityType: "poll",
        entityId: poll.id,
        op: "upsert",
        version: poll.version,
      });

      return poll;
    });
  }

  static async listPolls(householdId: string) {
    const pollRows = await db
      .select()
      .from(polls)
      .where(eq(polls.householdId, householdId))
      .orderBy(desc(polls.createdAt));

    const result = [];
    for (const p of pollRows) {
      const options = await db
        .select()
        .from(pollOptions)
        .where(eq(pollOptions.pollId, p.id));

      const votes = await db
        .select({
          pollOptionId: pollVotes.pollOptionId,
          userId: pollVotes.userId,
          voterName: users.displayName,
        })
        .from(pollVotes)
        .innerJoin(users, eq(pollVotes.userId, users.id))
        .where(
          sql`${pollVotes.pollOptionId} IN (${sql.join(
            options.map((o) => sql`${o.id}`),
            sql`, `
          )})`
        );

      result.push({
        ...p,
        options: options.map((opt) => ({
          ...opt,
          votes: votes.filter((v) => v.pollOptionId === opt.id),
        })),
      });
    }

    return result;
  }

  static async votePoll(pollOptionId: string, userId: string) {
    // Enforce 1 vote per user per poll
    const [opt] = await db
      .select({ pollId: pollOptions.pollId })
      .from(pollOptions)
      .where(eq(pollOptions.id, pollOptionId))
      .limit(1);

    if (!opt) {
      throw ApiError.notFound("Poll option not found");
    }

    const pollOptionsForPoll = await db
      .select({ id: pollOptions.id })
      .from(pollOptions)
      .where(eq(pollOptions.pollId, opt.pollId));

    const optionIds = pollOptionsForPoll.map((o) => o.id);

    // Remove any previous vote by this user on this poll
    await db
      .delete(pollVotes)
      .where(
        and(
          eq(pollVotes.userId, userId),
          sql`${pollVotes.pollOptionId} IN (${sql.join(optionIds.map(id => sql`${id}`), sql`, `)})`
        )
      );

    // Cast new vote
    await db.insert(pollVotes).values({
      pollOptionId,
      userId,
    });

    return { success: true };
  }

  // === AWAY PERIODS ===
  static async addAwayPeriod(input: {
    householdId: string;
    userId: string;
    startsOn: Date | string;
    endsOn: Date | string;
  }) {
    const starts = new Date(input.startsOn);
    const ends = new Date(input.endsOn);

    if (ends <= starts) {
      throw ApiError.badRequest("End date must be after start date", "INVALID_DATES");
    }

    const [period] = await db
      .insert(awayPeriods)
      .values({
        householdId: input.householdId,
        userId: input.userId,
        startsOn: starts,
        endsOn: ends,
      })
      .returning();

    return period;
  }

  static async listAwayPeriods(householdId: string) {
    return await db
      .select({
        id: awayPeriods.id,
        userId: awayPeriods.userId,
        userName: users.displayName,
        startsOn: awayPeriods.startsOn,
        endsOn: awayPeriods.endsOn,
        createdAt: awayPeriods.createdAt,
      })
      .from(awayPeriods)
      .innerJoin(users, eq(awayPeriods.userId, users.id))
      .where(eq(awayPeriods.householdId, householdId))
      .orderBy(desc(awayPeriods.startsOn));
  }
}

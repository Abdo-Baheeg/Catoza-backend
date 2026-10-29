import crypto from "crypto";
import { db, syncOperations, changeLog, expenses, expenseShares, notes, shoppingItems, memberships, } from "../db/index.js";
import { eq, and, gt, sql, inArray } from "drizzle-orm";
import { calculateShares } from "../domain/index.js";
function hashPayload(payload) {
    return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
export class SyncService {
    static async push(userId, operations) {
        if (operations.length > 50) {
            throw new Error("Batch size limit exceeded (max 50 operations per push)");
        }
        const results = [];
        // Process each op independently so one bad op never blocks the others
        for (const op of operations) {
            try {
                const payloadHash = hashPayload(op.payload);
                // 1. Idempotency check in sync_operations
                const [existingOp] = await db
                    .select()
                    .from(syncOperations)
                    .where(and(eq(syncOperations.userId, userId), eq(syncOperations.operationId, op.operationId)))
                    .limit(1);
                if (existingOp) {
                    if (existingOp.payloadHash === payloadHash) {
                        results.push({
                            operationId: op.operationId,
                            status: "duplicate",
                            serverEntity: existingOp.resultJson,
                        });
                        continue;
                    }
                    else {
                        results.push({
                            operationId: op.operationId,
                            status: "rejected",
                            error: "operationId reused with different payload",
                        });
                        continue;
                    }
                }
                // 2. Check membership
                const [membership] = await db
                    .select()
                    .from(memberships)
                    .where(and(eq(memberships.householdId, op.householdId), eq(memberships.userId, userId)))
                    .limit(1);
                if (!membership || membership.status === "left") {
                    results.push({
                        operationId: op.operationId,
                        status: "rejected",
                        error: "User is not an active member of this household",
                    });
                    continue;
                }
                // 3. Apply operation in its own transaction
                const result = await db.transaction(async (tx) => {
                    let serverVersion = 1;
                    let appliedData = null;
                    if (op.entityType === "expense") {
                        if (op.op === "create") {
                            const amountMinor = BigInt(op.payload.amountMinor);
                            const splitMethod = op.payload.splitMethod || "equal";
                            const participants = op.payload.participants || [];
                            const shares = calculateShares(amountMinor, splitMethod, participants);
                            const [newExp] = await tx
                                .insert(expenses)
                                .values({
                                id: op.entityId,
                                householdId: op.householdId,
                                payerId: op.payload.payerId || userId,
                                createdBy: userId,
                                title: op.payload.title || "Untitled Expense",
                                notes: op.payload.notes || null,
                                amountMinor,
                                category: op.payload.category || "general",
                                expenseDate: op.payload.expenseDate ? new Date(op.payload.expenseDate) : new Date(),
                                splitMethod,
                                version: 1,
                                status: "active",
                            })
                                .onConflictDoNothing()
                                .returning();
                            if (!newExp) {
                                // Already created
                                const [cur] = await tx.select().from(expenses).where(eq(expenses.id, op.entityId));
                                appliedData = cur;
                                serverVersion = cur.version;
                            }
                            else {
                                await tx.insert(expenseShares).values(shares.map((s) => ({
                                    expenseId: newExp.id,
                                    userId: s.userId,
                                    shareMinor: s.shareMinor,
                                })));
                                appliedData = newExp;
                                serverVersion = newExp.version;
                            }
                        }
                        else if (op.op === "update") {
                            const [curr] = await tx.select().from(expenses).where(eq(expenses.id, op.entityId));
                            if (!curr) {
                                return { status: "rejected", error: "Expense not found" };
                            }
                            if (curr.version !== op.baseVersion) {
                                return { status: "conflict", serverEntity: curr, version: curr.version };
                            }
                            const [upd] = await tx
                                .update(expenses)
                                .set({
                                title: op.payload.title || curr.title,
                                version: curr.version + 1,
                                updatedAt: new Date(),
                            })
                                .where(eq(expenses.id, op.entityId))
                                .returning();
                            appliedData = upd;
                            serverVersion = upd.version;
                        }
                    }
                    else if (op.entityType === "note") {
                        if (op.op === "create") {
                            const [note] = await tx
                                .insert(notes)
                                .values({
                                id: op.entityId,
                                householdId: op.householdId,
                                authorId: userId,
                                title: op.payload.title || null,
                                body: op.payload.body || "",
                                version: 1,
                            })
                                .onConflictDoNothing()
                                .returning();
                            appliedData = note;
                            serverVersion = note ? note.version : 1;
                        }
                        else if (op.op === "update") {
                            const [curr] = await tx.select().from(notes).where(eq(notes.id, op.entityId));
                            if (!curr)
                                return { status: "rejected", error: "Note not found" };
                            if (curr.version !== op.baseVersion) {
                                return { status: "conflict", serverEntity: curr, version: curr.version };
                            }
                            const [upd] = await tx
                                .update(notes)
                                .set({
                                body: op.payload.body || curr.body,
                                version: curr.version + 1,
                                updatedAt: new Date(),
                            })
                                .where(eq(notes.id, op.entityId))
                                .returning();
                            appliedData = upd;
                            serverVersion = upd.version;
                        }
                    }
                    else if (op.entityType === "shopping_item") {
                        if (op.op === "create") {
                            const [item] = await tx
                                .insert(shoppingItems)
                                .values({
                                id: op.entityId,
                                householdId: op.householdId,
                                name: op.payload.name || "Item",
                                qty: op.payload.qty || "1",
                                addedBy: userId,
                                version: 1,
                            })
                                .onConflictDoNothing()
                                .returning();
                            appliedData = item;
                            serverVersion = item ? item.version : 1;
                        }
                        else if (op.op === "update") {
                            const [curr] = await tx.select().from(shoppingItems).where(eq(shoppingItems.id, op.entityId));
                            if (!curr)
                                return { status: "rejected", error: "Shopping item not found" };
                            // Shopping items rule from spec: "bought" wins over "edited"
                            const isBought = op.payload.isBought === true;
                            const [upd] = await tx
                                .update(shoppingItems)
                                .set({
                                ...(isBought && { boughtBy: userId, boughtAt: new Date() }),
                                version: curr.version + 1,
                                updatedAt: new Date(),
                            })
                                .where(eq(shoppingItems.id, op.entityId))
                                .returning();
                            appliedData = upd;
                            serverVersion = upd.version;
                        }
                    }
                    // Append to change_log
                    await tx.insert(changeLog).values({
                        householdId: op.householdId,
                        entityType: op.entityType,
                        entityId: op.entityId,
                        op: op.op === "delete" ? "delete" : "upsert",
                        version: serverVersion,
                    });
                    // Store in sync_operations for idempotency
                    await tx.insert(syncOperations).values({
                        userId,
                        operationId: op.operationId,
                        payloadHash,
                        resultJson: appliedData || { success: true },
                    });
                    return {
                        status: "applied",
                        version: serverVersion,
                        serverEntity: appliedData,
                    };
                });
                results.push({
                    operationId: op.operationId,
                    status: result.status,
                    version: result.version,
                    serverEntity: result.serverEntity,
                    error: result.error,
                });
            }
            catch (err) {
                results.push({
                    operationId: op.operationId,
                    status: "rejected",
                    error: err.message || "Failed to process operation",
                });
            }
        }
        return results;
    }
    static async pull(userId, cursorStr) {
        // 1. Get all households user is active in
        const userMemberships = await db
            .select({ householdId: memberships.householdId })
            .from(memberships)
            .where(and(eq(memberships.userId, userId), sql `${memberships.status} != 'left'`));
        if (userMemberships.length === 0) {
            return { changes: [], nextCursor: "0", resyncRequired: false };
        }
        const householdIds = userMemberships.map((m) => m.householdId);
        const cursor = cursorStr ? BigInt(cursorStr) : 0n;
        // 2. Fetch changes with seq > cursor
        const changes = await db
            .select()
            .from(changeLog)
            .where(and(inArray(changeLog.householdId, householdIds), gt(changeLog.seq, cursor)))
            .orderBy(changeLog.seq)
            .limit(100);
        const nextCursor = changes.length > 0 ? changes[changes.length - 1].seq.toString() : cursor.toString();
        // Format changes with serialized seq
        const serializedChanges = changes.map((c) => ({
            seq: c.seq.toString(),
            householdId: c.householdId,
            entityType: c.entityType,
            entityId: c.entityId,
            op: c.op,
            version: c.version,
            createdAt: c.createdAt,
        }));
        return {
            changes: serializedChanges,
            nextCursor,
            resyncRequired: false,
        };
    }
}
//# sourceMappingURL=sync.service.js.map
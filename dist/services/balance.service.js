import { db, expenses, expenseShares, settlements, memberships, users } from "../db/index.js";
import { eq, and, sql } from "drizzle-orm";
import { computeHouseholdBalances, suggestSettlements, } from "../domain/index.js";
export class BalanceService {
    static async getBalances(householdId) {
        // 1. Get members
        const memberRows = await db
            .select({
            userId: users.id,
            displayName: users.displayName,
            email: users.email,
            avatarUrl: users.avatarUrl,
            instapayLink: users.instapayLink,
            instapayUsername: users.instapayUsername,
            status: memberships.status,
        })
            .from(memberships)
            .innerJoin(users, eq(memberships.userId, users.id))
            .where(eq(memberships.householdId, householdId));
        const memberIds = memberRows.map((m) => m.userId);
        // 2. Load active expenses and shares
        const expenseRows = await db
            .select({
            id: expenses.id,
            householdId: expenses.householdId,
            payerId: expenses.payerId,
            amountMinor: expenses.amountMinor,
            status: expenses.status,
        })
            .from(expenses)
            .where(and(eq(expenses.householdId, householdId), eq(expenses.status, "active"), sql `${expenses.deletedAt} IS NULL`));
        const expenseIds = expenseRows.map((e) => e.id);
        let allShares = [];
        if (expenseIds.length > 0) {
            allShares = await db
                .select({
                expenseId: expenseShares.expenseId,
                userId: expenseShares.userId,
                shareMinor: expenseShares.shareMinor,
            })
                .from(expenseShares)
                .where(sql `${expenseShares.expenseId} IN (${sql.join(expenseIds.map(id => sql `${id}`), sql `, `)})`);
        }
        const expenseRecords = expenseRows.map((e) => ({
            id: e.id,
            householdId: e.householdId,
            payerId: e.payerId,
            amountMinor: e.amountMinor,
            status: e.status,
            shares: allShares
                .filter((s) => s.expenseId === e.id)
                .map((s) => ({ userId: s.userId, shareMinor: s.shareMinor })),
        }));
        // 3. Load confirmed settlements
        const settlementRows = await db
            .select({
            id: settlements.id,
            householdId: settlements.householdId,
            fromUser: settlements.fromUser,
            toUser: settlements.toUser,
            amountMinor: settlements.amountMinor,
            status: settlements.status,
        })
            .from(settlements)
            .where(and(eq(settlements.householdId, householdId), eq(settlements.status, "confirmed")));
        const settlementRecords = settlementRows.map((s) => ({
            id: s.id,
            householdId: s.householdId,
            fromUser: s.fromUser,
            toUser: s.toUser,
            amountMinor: s.amountMinor,
            status: s.status,
        }));
        // 4. Compute domain balances
        const balanceMap = computeHouseholdBalances(memberIds, expenseRecords, settlementRecords);
        // 5. Compute settle-up suggestions
        const suggestions = suggestSettlements(balanceMap);
        // 6. Enrich with user info
        const enrichedBalances = Array.from(balanceMap.values()).map((b) => {
            const user = memberRows.find((m) => m.userId === b.userId);
            return {
                ...b,
                paidMinor: b.paidMinor.toString(),
                owedSharesMinor: b.owedSharesMinor.toString(),
                settlementsSentMinor: b.settlementsSentMinor.toString(),
                settlementsReceivedMinor: b.settlementsReceivedMinor.toString(),
                netBalanceMinor: b.netBalanceMinor.toString(),
                user: user || { userId: b.userId, displayName: "Unknown", avatarUrl: null },
            };
        });
        const enrichedSuggestions = suggestions.map((s) => {
            const fromUser = memberRows.find((m) => m.userId === s.fromUser);
            const toUser = memberRows.find((m) => m.userId === s.toUser);
            return {
                fromUser: s.fromUser,
                fromUserName: fromUser?.displayName || "Unknown",
                toUser: s.toUser,
                toUserName: toUser?.displayName || "Unknown",
                amountMinor: s.amountMinor.toString(),
                toInstapayLink: toUser?.instapayLink || null,
                toInstapayUsername: toUser?.instapayUsername || null,
            };
        });
        return {
            balances: enrichedBalances,
            suggestions: enrichedSuggestions,
        };
    }
}
//# sourceMappingURL=balance.service.js.map
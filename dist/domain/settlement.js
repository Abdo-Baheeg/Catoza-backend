/**
 * Generates simplified settle-up recommendations (min-transfer greedy heuristic).
 *
 * It pairs the largest debtor (most negative net balance) with the largest creditor
 * (most positive net balance) iteratively until all balances are settled.
 */
export function suggestSettlements(balances) {
    const balanceList = Array.isArray(balances)
        ? balances
        : Array.from(balances.values());
    // Creditors: netBalance > 0 (they are owed money)
    const creditors = [];
    // Debtors: netBalance < 0 (they owe money)
    const debtors = [];
    for (const b of balanceList) {
        if (b.netBalanceMinor > 0n) {
            creditors.push({ userId: b.userId, amount: b.netBalanceMinor });
        }
        else if (b.netBalanceMinor < 0n) {
            // Store owed amount as positive for easier greedy matching
            debtors.push({ userId: b.userId, amount: -b.netBalanceMinor });
        }
    }
    const suggestions = [];
    while (creditors.length > 0 && debtors.length > 0) {
        // Sort descending by amount
        creditors.sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));
        debtors.sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));
        const maxCreditor = creditors[0];
        const maxDebtor = debtors[0];
        // Transfer amount is the minimum of what debtor owes and creditor is owed
        const transferAmount = maxDebtor.amount < maxCreditor.amount ? maxDebtor.amount : maxCreditor.amount;
        if (transferAmount > 0n) {
            suggestions.push({
                fromUser: maxDebtor.userId,
                toUser: maxCreditor.userId,
                amountMinor: transferAmount,
            });
            maxDebtor.amount -= transferAmount;
            maxCreditor.amount -= transferAmount;
        }
        if (maxDebtor.amount === 0n) {
            debtors.shift();
        }
        if (maxCreditor.amount === 0n) {
            creditors.shift();
        }
    }
    return suggestions;
}
//# sourceMappingURL=settlement.js.map
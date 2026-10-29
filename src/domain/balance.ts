import { ExpenseRecord, SettlementRecord, UserBalance } from "./types.js";

/**
 * Computes net balances for all members in a household.
 *
 * Formula for each user:
 *   netBalance = paid - owed_shares + settlements_sent - settlements_received
 *
 * Meaning:
 * - netBalance > 0: user is a creditor (is owed money)
 * - netBalance < 0: user is a debtor (owes money)
 * - netBalance === 0: settled
 *
 * Invariants:
 * 1. Only active expenses are included.
 * 2. Only confirmed settlements are included.
 * 3. The sum of all net balances across the household strictly equals zero.
 */
export function computeHouseholdBalances(
  memberIds: string[],
  expenses: ExpenseRecord[],
  settlements: SettlementRecord[]
): Map<string, UserBalance> {
  const balanceMap = new Map<string, UserBalance>();

  for (const id of memberIds) {
    balanceMap.set(id, {
      userId: id,
      paidMinor: 0n,
      owedSharesMinor: 0n,
      settlementsSentMinor: 0n,
      settlementsReceivedMinor: 0n,
      netBalanceMinor: 0n,
    });
  }

  const getOrCreate = (userId: string): UserBalance => {
    let b = balanceMap.get(userId);
    if (!b) {
      b = {
        userId,
        paidMinor: 0n,
        owedSharesMinor: 0n,
        settlementsSentMinor: 0n,
        settlementsReceivedMinor: 0n,
        netBalanceMinor: 0n,
      };
      balanceMap.set(userId, b);
    }
    return b;
  };

  // 1. Process active expenses
  for (const expense of expenses) {
    if (expense.status !== "active") {
      continue;
    }

    const payer = getOrCreate(expense.payerId);
    payer.paidMinor += expense.amountMinor;

    for (const share of expense.shares) {
      const debtor = getOrCreate(share.userId);
      debtor.owedSharesMinor += share.shareMinor;
    }
  }

  // 2. Process confirmed settlements
  for (const settlement of settlements) {
    if (settlement.status !== "confirmed") {
      continue;
    }

    const sender = getOrCreate(settlement.fromUser);
    sender.settlementsSentMinor += settlement.amountMinor;

    const receiver = getOrCreate(settlement.toUser);
    receiver.settlementsReceivedMinor += settlement.amountMinor;
  }

  // 3. Compute net balance
  let totalNet = 0n;
  for (const b of balanceMap.values()) {
    b.netBalanceMinor =
      b.paidMinor - b.owedSharesMinor + b.settlementsSentMinor - b.settlementsReceivedMinor;
    totalNet += b.netBalanceMinor;
  }

  if (totalNet !== 0n) {
    throw new Error(
      `Ledger invariant violated: sum of all balances (${totalNet}) does not equal 0`
    );
  }

  return balanceMap;
}

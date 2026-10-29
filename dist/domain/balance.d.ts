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
export declare function computeHouseholdBalances(memberIds: string[], expenses: ExpenseRecord[], settlements: SettlementRecord[]): Map<string, UserBalance>;

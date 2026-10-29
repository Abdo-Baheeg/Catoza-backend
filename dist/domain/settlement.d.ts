import { SettleUpSuggestion, UserBalance } from "./types.js";
/**
 * Generates simplified settle-up recommendations (min-transfer greedy heuristic).
 *
 * It pairs the largest debtor (most negative net balance) with the largest creditor
 * (most positive net balance) iteratively until all balances are settled.
 */
export declare function suggestSettlements(balances: Map<string, UserBalance> | UserBalance[]): SettleUpSuggestion[];

export type SplitMethod = "equal" | "exact" | "percentage" | "shares";

export type ExpenseStatus = "active" | "cancelled" | "disputed";
export type SettlementStatus = "pending" | "confirmed" | "rejected";

export interface ParticipantShareInput {
  userId: string;
  // For 'exact', exact amount in minor units
  exactMinor?: bigint | number;
  // For 'percentage', value out of 100 (e.g. 33.33)
  percentage?: number;
  // For 'shares', weight/units (e.g. 2 for 2 shares)
  shares?: number;
}

export interface CalculatedShare {
  userId: string;
  shareMinor: bigint;
}

export interface ExpenseRecord {
  id: string;
  householdId: string;
  payerId: string;
  amountMinor: bigint;
  status: ExpenseStatus;
  shares: {
    userId: string;
    shareMinor: bigint;
  }[];
}

export interface SettlementRecord {
  id: string;
  householdId: string;
  fromUser: string;
  toUser: string;
  amountMinor: bigint;
  status: SettlementStatus;
}

export interface UserBalance {
  userId: string;
  paidMinor: bigint;
  owedSharesMinor: bigint;
  settlementsSentMinor: bigint;
  settlementsReceivedMinor: bigint;
  netBalanceMinor: bigint; // positive = owed money (creditor), negative = owes money (debtor)
}

export interface SettleUpSuggestion {
  fromUser: string;
  toUser: string;
  amountMinor: bigint;
}

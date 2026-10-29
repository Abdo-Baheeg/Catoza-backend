export type SplitMethod = "equal" | "exact" | "percentage" | "shares";
export type ExpenseStatus = "active" | "cancelled" | "disputed";
export type SettlementStatus = "pending" | "confirmed" | "rejected";
export interface ParticipantShareInput {
    userId: string;
    exactMinor?: bigint | number;
    percentage?: number;
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
    netBalanceMinor: bigint;
}
export interface SettleUpSuggestion {
    fromUser: string;
    toUser: string;
    amountMinor: bigint;
}

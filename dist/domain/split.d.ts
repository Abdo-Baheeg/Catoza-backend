import { CalculatedShare, ParticipantShareInput, SplitMethod } from "./types.js";
export declare class DomainError extends Error {
    readonly code: string;
    constructor(message: string, code?: string);
}
/**
 * Calculates and validates shares for an expense using integer minor units (piastres/cents).
 * Ensures:
 * 1. SUM(shares) === totalAmountMinor
 * 2. Deterministic remainder allocation (participants sorted by userId ascending)
 * 3. Float-free division and rounding
 */
export declare function calculateShares(totalAmountMinor: bigint, method: SplitMethod, participants: ParticipantShareInput[]): CalculatedShare[];

import { CalculatedShare, ParticipantShareInput, SplitMethod } from "./types.js";

export class DomainError extends Error {
  constructor(message: string, public readonly code: string = "DOMAIN_ERROR") {
    super(message);
    this.name = "DomainError";
  }
}

/**
 * Calculates and validates shares for an expense using integer minor units (piastres/cents).
 * Ensures:
 * 1. SUM(shares) === totalAmountMinor
 * 2. Deterministic remainder allocation (participants sorted by userId ascending)
 * 3. Float-free division and rounding
 */
export function calculateShares(
  totalAmountMinor: bigint,
  method: SplitMethod,
  participants: ParticipantShareInput[]
): CalculatedShare[] {
  if (totalAmountMinor <= 0n) {
    throw new DomainError("Total amount must be greater than zero", "INVALID_AMOUNT");
  }

  if (!participants || participants.length === 0) {
    throw new DomainError("At least one participant is required", "NO_PARTICIPANTS");
  }

  // Ensure unique participant user IDs
  const userIds = new Set<string>();
  for (const p of participants) {
    if (userIds.has(p.userId)) {
      throw new DomainError(`Duplicate participant ID: ${p.userId}`, "DUPLICATE_PARTICIPANT");
    }
    userIds.add(p.userId);
  }

  // Sort deterministically by userId for consistent remainder distribution across all nodes
  const sorted = [...participants].sort((a, b) => a.userId.localeCompare(b.userId));
  const n = BigInt(sorted.length);

  switch (method) {
    case "equal": {
      const base = totalAmountMinor / n;
      const remainder = Number(totalAmountMinor % n);

      return sorted.map((p, idx) => ({
        userId: p.userId,
        shareMinor: base + (idx < remainder ? 1n : 0n),
      }));
    }

    case "exact": {
      let sum = 0n;
      const result: CalculatedShare[] = [];

      for (const p of sorted) {
        if (p.exactMinor === undefined || p.exactMinor === null) {
          throw new DomainError(`Missing exact amount for participant ${p.userId}`, "INVALID_EXACT_SHARE");
        }
        const val = BigInt(p.exactMinor);
        if (val < 0n) {
          throw new DomainError(`Participant share cannot be negative (${p.userId})`, "NEGATIVE_SHARE");
        }
        sum += val;
        result.push({ userId: p.userId, shareMinor: val });
      }

      if (sum !== totalAmountMinor) {
        throw new DomainError(
          `Sum of exact shares (${sum}) does not equal total amount (${totalAmountMinor})`,
          "SHARES_SUM_MISMATCH"
        );
      }

      return result;
    }

    case "percentage": {
      // Percentages are given as numbers (e.g. 50 or 33.333)
      // We scale by 10000 (basis points) for integer arithmetic
      const SCALE = 10000n;
      let totalBasisPoints = 0n;
      const basisPointsList: bigint[] = [];

      for (const p of sorted) {
        if (p.percentage === undefined || p.percentage === null || p.percentage < 0) {
          throw new DomainError(`Invalid percentage for participant ${p.userId}`, "INVALID_PERCENTAGE");
        }
        // Round to 2 decimal places in basis points (e.g. 33.33% -> 3333 bp)
        const bp = BigInt(Math.round(p.percentage * 100));
        basisPointsList.push(bp);
        totalBasisPoints += bp;
      }

      // Check sum of percentages roughly equals 100% (10000 basis points)
      if (totalBasisPoints < 9990n || totalBasisPoints > 10010n) {
        throw new DomainError(
          `Total percentage must equal 100% (got ${(Number(totalBasisPoints) / 100).toFixed(2)}%)`,
          "PERCENTAGE_SUM_MISMATCH"
        );
      }

      // Calculate initial integer shares
      let sumCalculated = 0n;
      const initialShares = basisPointsList.map((bp) => {
        const share = (totalAmountMinor * bp) / totalBasisPoints;
        sumCalculated += share;
        return share;
      });

      // Distribute leftover remainder piastres deterministically to the first participants
      const remainder = Number(totalAmountMinor - sumCalculated);
      return sorted.map((p, idx) => ({
        userId: p.userId,
        shareMinor: initialShares[idx] + (idx < remainder ? 1n : 0n),
      }));
    }

    case "shares": {
      // Weighted shares (e.g., room sizes, ratios)
      let totalWeight = 0;
      for (const p of sorted) {
        if (p.shares === undefined || p.shares === null || p.shares <= 0) {
          throw new DomainError(`Share weight must be greater than 0 for ${p.userId}`, "INVALID_WEIGHT");
        }
        totalWeight += p.shares;
      }

      const totalWeightBig = BigInt(totalWeight);
      let sumCalculated = 0n;
      const initialShares = sorted.map((p) => {
        const share = (totalAmountMinor * BigInt(p.shares!)) / totalWeightBig;
        sumCalculated += share;
        return share;
      });

      const remainder = Number(totalAmountMinor - sumCalculated);
      return sorted.map((p, idx) => ({
        userId: p.userId,
        shareMinor: initialShares[idx] + (idx < remainder ? 1n : 0n),
      }));
    }

    default:
      throw new DomainError(`Unknown split method: ${method}`, "UNKNOWN_SPLIT_METHOD");
  }
}

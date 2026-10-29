import { describe, it, expect } from "vitest";
import {
  calculateShares,
  computeHouseholdBalances,
  suggestSettlements,
  ExpenseRecord,
  SettlementRecord,
  DomainError,
} from "../index.js";

describe("Domain Core: Money & Splits", () => {
  it("splits equally among 2 people with no remainder", () => {
    const shares = calculateShares(1000n, "equal", [
      { userId: "user-1" },
      { userId: "user-2" },
    ]);

    expect(shares).toEqual([
      { userId: "user-1", shareMinor: 500n },
      { userId: "user-2", shareMinor: 500n },
    ]);
  });

  it("splits equally among 3 people with deterministic remainder", () => {
    // 1000 piastres / 3 = 333 each with remainder 1
    // user-1 gets 334, user-2 gets 333, user-3 gets 333
    const shares = calculateShares(1000n, "equal", [
      { userId: "user-3" }, // input in random order
      { userId: "user-1" },
      { userId: "user-2" },
    ]);

    expect(shares).toEqual([
      { userId: "user-1", shareMinor: 334n },
      { userId: "user-2", shareMinor: 333n },
      { userId: "user-3", shareMinor: 333n },
    ]);

    const sum = shares.reduce((acc, s) => acc + s.shareMinor, 0n);
    expect(sum).toBe(1000n);
  });

  it("splits equally among 7 people deterministically", () => {
    const participants = [
      { userId: "u7" },
      { userId: "u2" },
      { userId: "u5" },
      { userId: "u1" },
      { userId: "u4" },
      { userId: "u6" },
      { userId: "u3" },
    ];
    // 100 piastres / 7 = 14 * 7 = 98, remainder 2.
    // The first 2 (u1, u2) get 15, the remaining 5 get 14.
    const shares = calculateShares(100n, "equal", participants);
    expect(shares[0]).toEqual({ userId: "u1", shareMinor: 15n });
    expect(shares[1]).toEqual({ userId: "u2", shareMinor: 15n });
    expect(shares[2]).toEqual({ userId: "u3", shareMinor: 14n });
    expect(shares[6]).toEqual({ userId: "u7", shareMinor: 14n });

    const total = shares.reduce((acc, s) => acc + s.shareMinor, 0n);
    expect(total).toBe(100n);
  });

  it("calculates exact splits and validates sum", () => {
    const shares = calculateShares(500n, "exact", [
      { userId: "u1", exactMinor: 200n },
      { userId: "u2", exactMinor: 300n },
    ]);

    expect(shares).toEqual([
      { userId: "u1", shareMinor: 200n },
      { userId: "u2", shareMinor: 300n },
    ]);

    // Throws if sum mismatch
    expect(() =>
      calculateShares(500n, "exact", [
        { userId: "u1", exactMinor: 200n },
        { userId: "u2", exactMinor: 250n },
      ])
    ).toThrow(DomainError);
  });

  it("calculates percentage splits", () => {
    const shares = calculateShares(1000n, "percentage", [
      { userId: "u1", percentage: 50 },
      { userId: "u2", percentage: 30 },
      { userId: "u3", percentage: 20 },
    ]);

    expect(shares).toEqual([
      { userId: "u1", shareMinor: 500n },
      { userId: "u2", shareMinor: 300n },
      { userId: "u3", shareMinor: 200n },
    ]);
  });

  it("calculates weighted shares splits", () => {
    // Total 1000, weights 1, 2, 1 (total weight 4)
    // u1 gets 250, u2 gets 500, u3 gets 250
    const shares = calculateShares(1000n, "shares", [
      { userId: "u1", shares: 1 },
      { userId: "u2", shares: 2 },
      { userId: "u3", shares: 1 },
    ]);

    expect(shares).toEqual([
      { userId: "u1", shareMinor: 250n },
      { userId: "u2", shareMinor: 500n },
      { userId: "u3", shareMinor: 250n },
    ]);
  });

  it("rejects zero and negative amounts", () => {
    expect(() => calculateShares(0n, "equal", [{ userId: "u1" }])).toThrow(DomainError);
    expect(() => calculateShares(-100n, "equal", [{ userId: "u1" }])).toThrow(DomainError);
  });
});

describe("Domain Core: Worked Example Ledger & Balances", () => {
  // Spec Section 12 (Milestone 3):
  // "Worked example (A pays 900, B pays 600, C pays 0 -> C pays A 400 and B 100)"
  it("computes balances and settlement suggestions for worked example", () => {
    const expenses: ExpenseRecord[] = [
      {
        id: "exp-1",
        householdId: "h-1",
        payerId: "A",
        amountMinor: 900n,
        status: "active",
        shares: [
          { userId: "A", shareMinor: 300n },
          { userId: "B", shareMinor: 300n },
          { userId: "C", shareMinor: 300n },
        ],
      },
      {
        id: "exp-2",
        householdId: "h-1",
        payerId: "B",
        amountMinor: 600n,
        status: "active",
        shares: [
          { userId: "A", shareMinor: 200n },
          { userId: "B", shareMinor: 200n },
          { userId: "C", shareMinor: 200n },
        ],
      },
    ];

    const balances = computeHouseholdBalances(["A", "B", "C"], expenses, []);

    // A: paid 900, owed 500 -> net +400
    expect(balances.get("A")?.netBalanceMinor).toBe(400n);
    // B: paid 600, owed 500 -> net +100
    expect(balances.get("B")?.netBalanceMinor).toBe(100n);
    // C: paid 0, owed 500 -> net -500
    expect(balances.get("C")?.netBalanceMinor).toBe(-500n);

    // Sum of net balances = 0
    const totalNet =
      balances.get("A")!.netBalanceMinor +
      balances.get("B")!.netBalanceMinor +
      balances.get("C")!.netBalanceMinor;
    expect(totalNet).toBe(0n);

    // Settle-up suggestion: C pays A 400, C pays B 100
    const suggestions = suggestSettlements(balances);
    expect(suggestions).toEqual([
      { fromUser: "C", toUser: "A", amountMinor: 400n },
      { fromUser: "C", toUser: "B", amountMinor: 100n },
    ]);
  });

  it("excludes cancelled and disputed expenses from balances", () => {
    const expenses: ExpenseRecord[] = [
      {
        id: "exp-1",
        householdId: "h-1",
        payerId: "A",
        amountMinor: 300n,
        status: "cancelled",
        shares: [
          { userId: "A", shareMinor: 150n },
          { userId: "B", shareMinor: 150n },
        ],
      },
      {
        id: "exp-2",
        householdId: "h-1",
        payerId: "A",
        amountMinor: 300n,
        status: "disputed",
        shares: [
          { userId: "A", shareMinor: 150n },
          { userId: "B", shareMinor: 150n },
        ],
      },
    ];

    const balances = computeHouseholdBalances(["A", "B"], expenses, []);
    expect(balances.get("A")?.netBalanceMinor).toBe(0n);
    expect(balances.get("B")?.netBalanceMinor).toBe(0n);
  });

  it("updates balances when settlement is confirmed, ignores pending", () => {
    const expenses: ExpenseRecord[] = [
      {
        id: "exp-1",
        householdId: "h-1",
        payerId: "A",
        amountMinor: 200n,
        status: "active",
        shares: [
          { userId: "A", shareMinor: 100n },
          { userId: "B", shareMinor: 100n },
        ],
      },
    ];

    const settlements: SettlementRecord[] = [
      {
        id: "set-1",
        householdId: "h-1",
        fromUser: "B",
        toUser: "A",
        amountMinor: 40n,
        status: "pending", // ignored until confirmed
      },
      {
        id: "set-2",
        householdId: "h-1",
        fromUser: "B",
        toUser: "A",
        amountMinor: 60n,
        status: "confirmed", // counted
      },
    ];

    const balances = computeHouseholdBalances(["A", "B"], expenses, settlements);

    // Initial: A is +100, B is -100
    // After 60 confirmed settlement from B to A:
    // A: paid 200 - owed 100 - sent 0 + received 60 = +40 (net balance)
    // B: paid 0 - owed 100 - sent 60 + received 0 = -40 (net balance)
    expect(balances.get("A")?.netBalanceMinor).toBe(40n);
    expect(balances.get("B")?.netBalanceMinor).toBe(-40n);

    const remainingSuggestions = suggestSettlements(balances);
    expect(remainingSuggestions).toEqual([
      { fromUser: "B", toUser: "A", amountMinor: 40n },
    ]);
  });
});

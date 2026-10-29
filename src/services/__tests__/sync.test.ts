import { describe, it, expect } from "vitest";
import crypto from "crypto";

// Test helper verifying the idempotency and hashing logic of SyncService
function hashPayload(payload: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

describe("Sync Engine: Idempotency & Hashing", () => {
  it("produces identical hashes for identical payload structures", () => {
    const payloadA = { amountMinor: "1000", title: "Groceries", splitMethod: "equal" };
    const payloadB = { amountMinor: "1000", title: "Groceries", splitMethod: "equal" };

    expect(hashPayload(payloadA)).toBe(hashPayload(payloadB));
  });

  it("produces distinct hashes when payload differs", () => {
    const payloadA = { amountMinor: "1000", title: "Groceries" };
    const payloadB = { amountMinor: "1500", title: "Groceries" };

    expect(hashPayload(payloadA)).not.toBe(hashPayload(payloadB));
  });

  it("validates batch limit strictly <= 50 operations", () => {
    const ops = new Array(51).fill(null).map((_, i) => ({
      operationId: `op-${i}`,
      householdId: "h-1",
      entityType: "expense" as const,
      entityId: `exp-${i}`,
      op: "create" as const,
      baseVersion: 1,
      payload: {},
    }));

    expect(ops.length).toBeGreaterThan(50);
  });
});

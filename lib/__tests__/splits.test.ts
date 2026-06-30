import { describe, it, expect } from "vitest";
import { computeSplits, distribute } from "@/lib/splits";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`);

describe("distribute", () => {
  it("splits evenly when divisible", () => {
    expect(distribute(900, [1, 1, 1])).toEqual([300, 300, 300]);
  });

  it("hands out the remainder deterministically (largest fraction first)", () => {
    // 1000 / 3 = 333.33 each; 1 leftover unit
    const parts = distribute(1000, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(parts).toEqual([334, 333, 333]);
  });

  it("respects weights", () => {
    expect(distribute(1000, [3, 1])).toEqual([750, 250]);
  });

  it("throws when weights sum to zero", () => {
    expect(() => distribute(100, [0, 0])).toThrow();
  });
});

describe("computeSplits", () => {
  it("equal split always sums to the total", () => {
    const r = computeSplits(1000, "equal", ids(3).map((userId) => ({ userId })));
    expect(r.reduce((a, s) => a + s.amount, 0)).toBe(1000);
    expect(r.map((s) => s.amount)).toEqual([334, 333, 333]);
  });

  it("exact split validates the sum", () => {
    const ok = computeSplits(1000, "exact", [
      { userId: "a", value: 600 },
      { userId: "b", value: 400 },
    ]);
    expect(ok.map((s) => s.amount)).toEqual([600, 400]);

    expect(() =>
      computeSplits(1000, "exact", [
        { userId: "a", value: 600 },
        { userId: "b", value: 300 },
      ]),
    ).toThrow();
  });

  it("percentage split sums to total and stores raw percentages", () => {
    const r = computeSplits(1000, "percentage", [
      { userId: "a", value: 50 },
      { userId: "b", value: 30 },
      { userId: "c", value: 20 },
    ]);
    expect(r.reduce((a, s) => a + s.amount, 0)).toBe(1000);
    expect(r.map((s) => s.amount)).toEqual([500, 300, 200]);
    expect(r.map((s) => s.shareValue)).toEqual([50, 30, 20]);
  });

  it("rejects percentages that do not sum to 100", () => {
    expect(() =>
      computeSplits(1000, "percentage", [
        { userId: "a", value: 50 },
        { userId: "b", value: 40 },
      ]),
    ).toThrow();
  });

  it("shares split allocates proportionally and sums to total", () => {
    const r = computeSplits(1000, "shares", [
      { userId: "a", value: 2 },
      { userId: "b", value: 1 },
      { userId: "c", value: 1 },
    ]);
    expect(r.reduce((a, s) => a + s.amount, 0)).toBe(1000);
    expect(r.map((s) => s.amount)).toEqual([500, 250, 250]);
  });

  it("handles indivisible share totals without losing cents", () => {
    const r = computeSplits(1000, "shares", [
      { userId: "a", value: 1 },
      { userId: "b", value: 1 },
      { userId: "c", value: 1 },
    ]);
    expect(r.reduce((a, s) => a + s.amount, 0)).toBe(1000);
  });
});

import { describe, it, expect } from "vitest";
import {
  computeNetBalances,
  simplifyDebts,
  balancesForUser,
  type BalanceExpense,
} from "@/lib/balances";

function sum(map: Map<string, number>) {
  return [...map.values()].reduce((a, b) => a + b, 0);
}

describe("computeNetBalances", () => {
  it("a pays 100 split equally between a and b", () => {
    const expenses: BalanceExpense[] = [
      {
        paidBy: "a",
        baseAmount: 10000,
        splits: [
          { userId: "a", amount: 5000 },
          { userId: "b", amount: 5000 },
        ],
      },
    ];
    const net = computeNetBalances(expenses);
    expect(net.get("a")).toBe(5000);
    expect(net.get("b")).toBe(-5000);
    expect(sum(net)).toBe(0);
  });

  it("always sums to zero even with rounding", () => {
    const expenses: BalanceExpense[] = [
      {
        paidBy: "a",
        baseAmount: 1000,
        splits: [
          { userId: "a", amount: 1 },
          { userId: "b", amount: 1 },
          { userId: "c", amount: 1 },
        ],
      },
    ];
    const net = computeNetBalances(expenses);
    expect(sum(net)).toBe(0);
  });

  it("settlements reduce balances toward zero", () => {
    const expenses: BalanceExpense[] = [
      {
        paidBy: "a",
        baseAmount: 10000,
        splits: [
          { userId: "a", amount: 5000 },
          { userId: "b", amount: 5000 },
        ],
      },
    ];
    const net = computeNetBalances(expenses, [
      { fromUserId: "b", toUserId: "a", baseAmount: 5000 },
    ]);
    expect(net.get("a")).toBe(0);
    expect(net.get("b")).toBe(0);
  });

  it("handles a multi-currency-style mix via base amounts", () => {
    const expenses: BalanceExpense[] = [
      // a paid base 6000, split 3 ways
      {
        paidBy: "a",
        baseAmount: 6000,
        splits: [
          { userId: "a", amount: 1 },
          { userId: "b", amount: 1 },
          { userId: "c", amount: 1 },
        ],
      },
      // b paid base 3000, split between b and c
      {
        paidBy: "b",
        baseAmount: 3000,
        splits: [
          { userId: "b", amount: 1 },
          { userId: "c", amount: 1 },
        ],
      },
    ];
    const net = computeNetBalances(expenses);
    expect(sum(net)).toBe(0);
    // a paid 6000, owes 2000 -> +4000
    expect(net.get("a")).toBe(4000);
    // b paid 3000, owes 2000 + 1500 = 3500 -> -500
    expect(net.get("b")).toBe(-500);
    // c paid 0, owes 2000 + 1500 = 3500 -> -3500
    expect(net.get("c")).toBe(-3500);
  });
});

describe("simplifyDebts", () => {
  it("produces transactions that settle every balance", () => {
    const net = new Map([
      ["a", 4000],
      ["b", -500],
      ["c", -3500],
    ]);
    const txns = simplifyDebts(net);
    // Re-apply transactions and confirm everyone reaches zero.
    const check = new Map(net);
    for (const t of txns) {
      check.set(t.from, (check.get(t.from) ?? 0) + t.amount);
      check.set(t.to, (check.get(t.to) ?? 0) - t.amount);
    }
    for (const v of check.values()) expect(v).toBe(0);
  });

  it("uses at most n-1 transactions", () => {
    const net = new Map([
      ["a", 1000],
      ["b", 2000],
      ["c", -1500],
      ["d", -1500],
    ]);
    const txns = simplifyDebts(net);
    expect(txns.length).toBeLessThanOrEqual(3);
    expect(txns.every((t) => t.amount > 0)).toBe(true);
  });

  it("returns nothing when everyone is settled", () => {
    expect(simplifyDebts(new Map([["a", 0], ["b", 0]]))).toEqual([]);
  });
});

describe("balancesForUser", () => {
  it("derives per-person owed/owing from transactions", () => {
    const txns = [
      { from: "c", to: "a", amount: 3500 },
      { from: "b", to: "a", amount: 500 },
    ];
    const forA = balancesForUser(txns, "a");
    expect(forA.get("c")).toBe(3500);
    expect(forA.get("b")).toBe(500);

    const forC = balancesForUser(txns, "c");
    expect(forC.get("a")).toBe(-3500);
  });
});

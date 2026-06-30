import { distribute } from "@/lib/splits";

export type BalanceExpense = {
  paidBy: string;
  /** Total expense amount converted to the group base currency (minor units). */
  baseAmount: number;
  /**
   * Per-participant split, with `amount` in the expense's original currency.
   * These are used purely as weights to allocate `baseAmount`, which keeps each
   * expense exactly zero-sum in the base currency.
   */
  splits: { userId: string; amount: number }[];
};

export type BalanceSettlement = {
  fromUserId: string;
  toUserId: string;
  /** Settlement amount in the group base currency (minor units). */
  baseAmount: number;
};

export type Transaction = {
  from: string;
  to: string;
  amount: number;
};

/**
 * Net balance per user in the group base currency (minor units).
 * Positive  => the group owes this user (they are a creditor / "gets back").
 * Negative  => this user owes the group (they are a debtor / "owes").
 * The returned map always sums to zero.
 */
export function computeNetBalances(
  expenses: BalanceExpense[],
  settlements: BalanceSettlement[] = [],
): Map<string, number> {
  const net = new Map<string, number>();
  const add = (userId: string, delta: number) =>
    net.set(userId, (net.get(userId) ?? 0) + delta);

  for (const expense of expenses) {
    add(expense.paidBy, expense.baseAmount);

    const weights = expense.splits.map((s) => s.amount);
    const totalWeight = weights.reduce((a, w) => a + w, 0);

    if (expense.baseAmount === 0 || totalWeight === 0) {
      // Nothing to allocate (zero expense or zero-weight splits).
      continue;
    }

    const allocations = distribute(expense.baseAmount, weights);
    expense.splits.forEach((s, i) => add(s.userId, -allocations[i]));
  }

  for (const s of settlements) {
    // The debtor pays the creditor: debtor's balance rises toward zero,
    // creditor's balance falls toward zero.
    add(s.fromUserId, s.baseAmount);
    add(s.toUserId, -s.baseAmount);
  }

  return net;
}

/**
 * Greedy debt simplification: repeatedly settle the largest creditor against
 * the largest debtor. Produces a near-minimal set of transactions (the optimal
 * problem is NP-hard) where each transaction is `from` (debtor) pays `to`
 * (creditor) `amount` minor units. Input balances are not mutated.
 */
export function simplifyDebts(net: Map<string, number>): Transaction[] {
  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];

  for (const [id, amount] of net) {
    if (amount > 0) creditors.push({ id, amount });
    else if (amount < 0) debtors.push({ id, amount: -amount });
  }

  // Largest first for a tight, deterministic result.
  creditors.sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
  debtors.sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));

  const transactions: Transaction[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const amount = Math.min(creditor.amount, debtor.amount);

    if (amount > 0) {
      transactions.push({ from: debtor.id, to: creditor.id, amount });
      creditor.amount -= amount;
      debtor.amount -= amount;
    }

    if (creditor.amount === 0) ci += 1;
    if (debtor.amount === 0) di += 1;
  }

  return transactions;
}

/**
 * Pairwise balances from one user's perspective: how much each other user owes
 * them (positive) or they owe each other user (negative), derived from the
 * simplified transactions. Useful for the per-person "who owes whom" view.
 */
export function balancesForUser(
  transactions: Transaction[],
  userId: string,
): Map<string, number> {
  const result = new Map<string, number>();
  const add = (other: string, delta: number) =>
    result.set(other, (result.get(other) ?? 0) + delta);

  for (const t of transactions) {
    if (t.to === userId) add(t.from, t.amount); // someone pays me => they owe me
    if (t.from === userId) add(t.to, -t.amount); // I pay someone => I owe them
  }
  return result;
}

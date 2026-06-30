import type { SplitType } from "@/lib/db/schema";

export type SplitInput = {
  userId: string;
  /**
   * Raw value whose meaning depends on the split type:
   * - equal: ignored
   * - exact: minor units this user owes
   * - percentage: percent (0–100) this user owes
   * - shares: relative weight (any positive number)
   */
  value?: number;
};

export type ComputedSplit = {
  userId: string;
  /** This user's share of the total, in minor units. */
  amount: number;
  /** Raw input preserved for re-editing (percentage or weight), else null. */
  shareValue: number | null;
};

/**
 * Distribute `total` minor units across `n` weighted buckets so the parts sum
 * exactly to `total`. Each bucket gets floor(total * weight/totalWeight); the
 * leftover minor units are handed out one at a time to the buckets with the
 * largest fractional remainder (ties broken by original order).
 */
export function distribute(total: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((a, w) => a + w, 0);
  if (totalWeight <= 0) {
    throw new Error("Split weights must sum to a positive number.");
  }

  const exact = weights.map((w) => (total * w) / totalWeight);
  const floors = exact.map((x) => Math.floor(x));
  let remainder = total - floors.reduce((a, x) => a + x, 0);

  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  const result = [...floors];
  let k = 0;
  while (remainder > 0) {
    result[order[k % order.length].i] += 1;
    remainder -= 1;
    k += 1;
  }
  return result;
}

/**
 * Reduce any of the four split methods to a concrete per-user amount (minor
 * units) that sums exactly to `total`. Throws on invalid input so callers can
 * surface a validation error.
 */
export function computeSplits(
  total: number,
  splitType: SplitType,
  participants: SplitInput[],
): ComputedSplit[] {
  if (participants.length === 0) {
    throw new Error("An expense needs at least one participant.");
  }
  if (total < 0) {
    throw new Error("Amount cannot be negative.");
  }

  switch (splitType) {
    case "equal": {
      const amounts = distribute(
        total,
        participants.map(() => 1),
      );
      return participants.map((p, i) => ({
        userId: p.userId,
        amount: amounts[i],
        shareValue: null,
      }));
    }

    case "exact": {
      const amounts = participants.map((p) => Math.round(p.value ?? 0));
      const sum = amounts.reduce((a, x) => a + x, 0);
      if (sum !== total) {
        throw new Error(
          `Exact amounts must sum to the total (got ${sum}, expected ${total}).`,
        );
      }
      return participants.map((p, i) => ({
        userId: p.userId,
        amount: amounts[i],
        shareValue: null,
      }));
    }

    case "percentage": {
      const percentages = participants.map((p) => p.value ?? 0);
      const sum = percentages.reduce((a, x) => a + x, 0);
      if (Math.abs(sum - 100) > 1e-6) {
        throw new Error(
          `Percentages must sum to 100 (got ${sum}).`,
        );
      }
      const amounts = distribute(total, percentages);
      return participants.map((p, i) => ({
        userId: p.userId,
        amount: amounts[i],
        shareValue: percentages[i],
      }));
    }

    case "shares": {
      const weights = participants.map((p) => p.value ?? 0);
      if (weights.some((w) => w < 0)) {
        throw new Error("Shares cannot be negative.");
      }
      const amounts = distribute(total, weights);
      return participants.map((p, i) => ({
        userId: p.userId,
        amount: amounts[i],
        shareValue: weights[i],
      }));
    }

    default: {
      const _exhaustive: never = splitType;
      throw new Error(`Unknown split type: ${_exhaustive}`);
    }
  }
}

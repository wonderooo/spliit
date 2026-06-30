import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { exchangeRates } from "@/lib/db/schema";

const FRANKFURTER_BASE = "https://api.frankfurter.dev/v1";

/**
 * Exchange rate to convert 1 unit of `base` into `target`, for the given date.
 * Order of resolution:
 *   1. same currency -> 1
 *   2. cached value in `exchange_rates`
 *   3. Frankfurter API (ECB rates) -> cached on success
 * Returns `null` if no rate could be determined, so the caller can ask the
 * user to enter one manually.
 */
export async function getRate(
  date: string,
  base: string,
  target: string,
): Promise<number | null> {
  if (base === target) return 1;

  const cached = await db
    .select()
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.date, date),
        eq(exchangeRates.base, base),
        eq(exchangeRates.target, target),
      ),
    )
    .limit(1);

  if (cached.length > 0) {
    return Number(cached[0].rate);
  }

  const rate = await fetchFrankfurter(date, base, target);
  if (rate === null) return null;

  // Cache it (ignore unique-constraint races).
  try {
    await db
      .insert(exchangeRates)
      .values({ date, base, target, rate: String(rate) })
      .onConflictDoNothing();
  } catch {
    // best-effort cache; ignore
  }

  return rate;
}

async function fetchFrankfurter(
  date: string,
  base: string,
  target: string,
): Promise<number | null> {
  const url = `${FRANKFURTER_BASE}/${date}?base=${encodeURIComponent(
    base,
  )}&symbols=${encodeURIComponent(target)}`;
  try {
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 12 } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      rates?: Record<string, number>;
    };
    const rate = data.rates?.[target];
    return typeof rate === "number" ? rate : null;
  } catch {
    return null;
  }
}

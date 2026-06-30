"use server";

import { getRate } from "@/lib/fx";
import { getSession } from "@/lib/session";

/**
 * Suggested exchange rate (1 `from` = rate `to`) for an expense date.
 * Returns null when no rate is available, so the UI can ask for manual entry.
 */
export async function getSuggestedRate(
  date: string,
  from: string,
  to: string,
): Promise<number | null> {
  const session = await getSession();
  if (!session?.user) return null;
  if (from === to) return 1;
  return getRate(date, from, to);
}

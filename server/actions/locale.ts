"use server";

import { cookies } from "next/headers";
import { hasLocale, LOCALE_COOKIE } from "@/lib/i18n/config";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Persist the chosen UI language in the NEXT_LOCALE cookie. The caller should
 * `await` this and then `router.refresh()` so the new cookie is read on the
 * next render (a freshly-set cookie is not readable within this same request).
 */
export async function setLocale(locale: string): Promise<void> {
  if (!hasLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
}

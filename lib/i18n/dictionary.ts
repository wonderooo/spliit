import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { defaultLocale, hasLocale, LOCALE_COOKIE, type Locale } from "./config";

// `en.json` is the source of truth for the dictionary shape. `pl.json` must
// match it structurally - enforced by `dictionaries/pl.typecheck.ts`.
import type en from "./dictionaries/en.json";
export type Dictionary = typeof en;

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import("./dictionaries/en.json").then((m) => m.default),
  pl: () => import("./dictionaries/pl.json").then((m) => m.default as Dictionary),
};

/** The active locale for this request, from the NEXT_LOCALE cookie. Memoized. */
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return value && hasLocale(value) ? value : defaultLocale;
});

/** The dictionary for the active locale. Memoized - cheap to call per component. */
export const getDictionary = cache(async (): Promise<Dictionary> => {
  const locale = await getLocale();
  return dictionaries[locale]();
});

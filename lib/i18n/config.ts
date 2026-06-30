/**
 * i18n configuration shared by both server and client. Keep this file free of
 * `server-only` and `next/headers` imports so the client provider can use it too.
 */

export const locales = ["en", "pl"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Cookie that stores the chosen locale (read server-side to pick the dictionary). */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Display labels for the language switcher. */
export const localeNames: Record<Locale, string> = {
  en: "English",
  pl: "Polski",
};

/** BCP-47 tags for Intl formatting (numbers, currency, dates). */
export const localeToIntl: Record<Locale, string> = {
  en: "en-US",
  pl: "pl-PL",
};

export function hasLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/**
 * Substitute `{name}` placeholders in a template string. Used for the handful
 * of strings that interpolate runtime values (counts, names, amounts).
 */
export function format(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}

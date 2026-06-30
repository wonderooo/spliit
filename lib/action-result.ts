import type { Dictionary } from "@/lib/i18n/dictionary";

/**
 * Server actions return a locale-agnostic error CODE (a key of the `errors`
 * dictionary namespace), never localized prose. The client maps the code to a
 * message via `errorText` so all error text lives in the dictionaries.
 */
export type ActionErrorCode = keyof Dictionary["errors"];

export type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? Record<never, never> : { data: T }))
  | { ok: false; error: ActionErrorCode };

export function ok(): { ok: true };
export function ok<T>(data: T): { ok: true; data: T };
export function ok<T>(data?: T) {
  return data === undefined ? { ok: true } : { ok: true, data };
}

export function fail(
  error: ActionErrorCode,
): { ok: false; error: ActionErrorCode } {
  return { ok: false, error };
}

/** Resolve an error code (or any thrown message) to localized text. */
export function errorText(dict: Dictionary, code: string): string {
  const errors = dict.errors as Record<string, string>;
  return errors[code] ?? dict.errors.unknown;
}

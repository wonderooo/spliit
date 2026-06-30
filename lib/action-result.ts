export type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? Record<never, never> : { data: T }))
  | { ok: false; error: string };

export function ok(): { ok: true };
export function ok<T>(data: T): { ok: true; data: T };
export function ok<T>(data?: T) {
  return data === undefined ? { ok: true } : { ok: true, data };
}

export function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

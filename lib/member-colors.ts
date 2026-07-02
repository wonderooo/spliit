/**
 * Per-member accent colors.
 *
 * The app's theme is fully achromatic (grays), so member colors are the only
 * hue in the UI - they're kept muted and mid-toned to fit that gamma rather
 * than reading as neon. Each key maps to a CSS variable (`--member-<key>`)
 * defined for both light and dark themes in globals.css, so the same stored
 * key renders correctly whatever the theme.
 *
 * Colors are stored per group membership (group_members.color), like the
 * per-group display name, so the same person can differ across groups and
 * clashes within a group can be avoided.
 */
export const MEMBER_COLORS = [
  "rose",
  "orange",
  "amber",
  "lime",
  "emerald",
  "teal",
  "cyan",
  "blue",
  "violet",
  "fuchsia",
] as const;

export type MemberColor = (typeof MEMBER_COLORS)[number];

export function isMemberColor(value: unknown): value is MemberColor {
  return (
    typeof value === "string" &&
    (MEMBER_COLORS as readonly string[]).includes(value)
  );
}

/**
 * Pick a color for a new member: prefer one not already taken in the group,
 * falling back to any color (varied by the taken count) once they're all used.
 * `seed` only nudges which unused color is chosen so concurrent joins vary.
 */
export function pickMemberColor(taken: readonly string[], seed = 0): MemberColor {
  const free = MEMBER_COLORS.filter((c) => !taken.includes(c));
  const pool = free.length > 0 ? free : MEMBER_COLORS;
  return pool[(taken.length + seed) % pool.length];
}

/** Inline style that colors text/icons in a member's color. */
export function memberColorStyle(
  color: string | null | undefined,
): React.CSSProperties | undefined {
  if (!isMemberColor(color)) return undefined;
  return { color: `var(--member-${color})` };
}

/** Inline style for an avatar/badge: soft tinted background + colored content. */
export function memberAvatarStyle(
  color: string | null | undefined,
): React.CSSProperties | undefined {
  if (!isMemberColor(color)) return undefined;
  return {
    backgroundColor: `color-mix(in oklab, var(--member-${color}) 18%, transparent)`,
    color: `var(--member-${color})`,
  };
}

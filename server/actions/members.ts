"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { groupMembers } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getMembership } from "@/lib/queries";
import {
  updateMemberNameSchema,
  updateMemberColorSchema,
  removeMemberSchema,
} from "@/lib/validators";
import {
  ok,
  fail,
  type ActionResult,
  type ActionErrorCode,
} from "@/lib/action-result";

/** Rename yourself within a group. The display name only affects this group. */
export async function updateMemberName(
  input: unknown,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return fail("notSignedIn");

  const parsed = updateMemberNameSchema.safeParse(input);
  if (!parsed.success) {
    return fail((parsed.error.issues[0]?.message as ActionErrorCode) ?? "invalidInput");
  }
  const { groupId, name } = parsed.data;

  const result = await db
    .update(groupMembers)
    .set({ name })
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, session.user.id),
      ),
    )
    .returning({ id: groupMembers.id });

  if (result.length === 0) return fail("notAMember");

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/members`);
  return ok();
}

/**
 * Owner-only soft removal of a member. Their expenses, splits and settlements
 * are left intact - only their membership is marked removed, so they lose
 * access but still resolve (as "removed") wherever their name already appears.
 */
export async function removeMember(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return fail("notSignedIn");

  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      (parsed.error.issues[0]?.message as ActionErrorCode) ?? "invalidInput",
    );
  }
  const { groupId, userId } = parsed.data;

  if (userId === session.user.id) return fail("cannotRemoveSelf");

  const me = await getMembership(groupId, session.user.id);
  if (!me || me.removedAt) return fail("notAMember");
  if (me.role !== "owner") return fail("notGroupOwner");

  const result = await db
    .update(groupMembers)
    .set({ removedAt: new Date() })
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId),
        isNull(groupMembers.removedAt),
      ),
    )
    .returning({ id: groupMembers.id });

  if (result.length === 0) return fail("notAMember");

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/members`);
  return ok();
}

/** Change your own accent color within a group. */
export async function updateMemberColor(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return fail("notSignedIn");

  const parsed = updateMemberColorSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      (parsed.error.issues[0]?.message as ActionErrorCode) ?? "invalidInput",
    );
  }
  const { groupId, color } = parsed.data;

  const result = await db
    .update(groupMembers)
    .set({ color })
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, session.user.id),
      ),
    )
    .returning({ id: groupMembers.id });

  if (result.length === 0) return fail("notAMember");

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/members`);
  return ok();
}

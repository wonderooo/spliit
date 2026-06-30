"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { groupMembers } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { updateMemberNameSchema } from "@/lib/validators";
import { ok, fail, type ActionResult } from "@/lib/action-result";

/** Rename yourself within a group. The display name only affects this group. */
export async function updateMemberName(
  input: unknown,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return fail("You must be signed in.");

  const parsed = updateMemberNameSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
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

  if (result.length === 0) return fail("You are not a member of this group.");

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/members`);
  return ok();
}

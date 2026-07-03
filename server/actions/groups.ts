"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { groups, groupMembers } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getMembership } from "@/lib/queries";
import { createGroupSchema, updateGroupSchema } from "@/lib/validators";
import { pickMemberColor } from "@/lib/member-colors";
import {
  ok,
  fail,
  type ActionResult,
  type ActionErrorCode,
} from "@/lib/action-result";

export async function createGroup(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session?.user) return fail("notSignedIn");

  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) {
    return fail((parsed.error.issues[0]?.message as ActionErrorCode) ?? "invalidInput");
  }
  const { name, description, baseCurrency } = parsed.data;

  const [group] = await db
    .insert(groups)
    .values({
      name,
      description: description || null,
      baseCurrency,
      createdBy: session.user.id,
    })
    .returning({ id: groups.id });

  await db.insert(groupMembers).values({
    groupId: group.id,
    userId: session.user.id,
    role: "owner",
    color: pickMemberColor([]),
  });

  revalidatePath("/dashboard");
  return ok({ id: group.id });
}

/** Owner-only edit of the group's name, description and base currency. */
export async function updateGroup(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return fail("notSignedIn");

  const parsed = updateGroupSchema.safeParse(input);
  if (!parsed.success) {
    return fail((parsed.error.issues[0]?.message as ActionErrorCode) ?? "invalidInput");
  }
  const { groupId, name, description, baseCurrency } = parsed.data;

  const me = await getMembership(groupId, session.user.id);
  if (!me || me.removedAt) return fail("notAMember");
  if (me.role !== "owner") return fail("notGroupOwner");

  await db
    .update(groups)
    .set({ name, description: description || null, baseCurrency })
    .where(eq(groups.id, groupId));

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/dashboard");
  return ok();
}

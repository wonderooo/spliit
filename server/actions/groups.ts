"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { db } from "@/lib/db";
import { groups, groupMembers, user } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getMembership } from "@/lib/queries";
import {
  createGroupSchema,
  updateGroupSchema,
  deleteGroupSchema,
} from "@/lib/validators";
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

/**
 * Owner-only permanent deletion of a group. The FK cascades take everything
 * the group owns (members, invitations, expenses with their splits and
 * receipts, settlements). Guest placeholder users hang off the user table,
 * not the group, so they are deleted explicitly. Irreversible.
 */
export async function deleteGroup(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return fail("notSignedIn");

  const parsed = deleteGroupSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      (parsed.error.issues[0]?.message as ActionErrorCode) ?? "invalidInput",
    );
  }
  const { groupId } = parsed.data;

  const me = await getMembership(groupId, session.user.id);
  if (!me || me.removedAt) return fail("notAMember");
  if (me.role !== "owner") return fail("notGroupOwner");

  const guests = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.synthetic, true),
      ),
    );

  const stmts: BatchItem<"pg">[] = [];
  if (guests.length) {
    stmts.push(
      db.delete(user).where(
        inArray(
          user.id,
          guests.map((g) => g.userId),
        ),
      ),
    );
  }
  stmts.push(db.delete(groups).where(eq(groups.id, groupId)));
  await db.batch(stmts as [BatchItem<"pg">, ...BatchItem<"pg">[]]);

  revalidatePath("/dashboard");
  return ok();
}

"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { db } from "@/lib/db";
import {
  groupMembers,
  expenses,
  expenseSplits,
  settlements,
  user,
} from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getMembership } from "@/lib/queries";
import { pickMemberColor } from "@/lib/member-colors";
import {
  updateMemberNameSchema,
  updateMemberColorSchema,
  addSyntheticMemberSchema,
  mergeSyntheticMemberSchema,
  removeMemberSchema,
  leaveGroupSchema,
} from "@/lib/validators";
import {
  ok,
  fail,
  type ActionResult,
  type ActionErrorCode,
} from "@/lib/action-result";

/**
 * Resolve which membership a name/color edit targets. Editing yourself is
 * always allowed; editing someone else requires being the owner and the target
 * being an active guest (synthetic) member.
 */
async function resolveEditTarget(
  groupId: string,
  sessionUserId: string,
  userId: string | undefined,
): Promise<
  { ok: true; targetId: string } | { ok: false; error: ActionErrorCode }
> {
  const targetId = userId ?? sessionUserId;
  if (targetId === sessionUserId) return { ok: true, targetId };

  const me = await getMembership(groupId, sessionUserId);
  if (!me || me.removedAt) return { ok: false, error: "notAMember" };
  if (me.role !== "owner") return { ok: false, error: "notGroupOwner" };

  const target = await getMembership(groupId, targetId);
  if (!target || target.removedAt) return { ok: false, error: "notAMember" };
  if (!target.synthetic) return { ok: false, error: "cannotEditMember" };

  return { ok: true, targetId };
}

/** Rename yourself (or, as the owner, a guest member) within a group. The
 *  display name only affects this group. */
export async function updateMemberName(
  input: unknown,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return fail("notSignedIn");

  const parsed = updateMemberNameSchema.safeParse(input);
  if (!parsed.success) {
    return fail((parsed.error.issues[0]?.message as ActionErrorCode) ?? "invalidInput");
  }
  const { groupId, name, userId } = parsed.data;

  const target = await resolveEditTarget(groupId, session.user.id, userId);
  if (!target.ok) return fail(target.error);

  const result = await db
    .update(groupMembers)
    .set({ name })
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, target.targetId),
      ),
    )
    .returning({ id: groupMembers.id });

  if (result.length === 0) return fail("notAMember");

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/members`);
  return ok();
}

/**
 * Owner-only: add a guest member for someone who doesn't want to sign in.
 * Backed by a placeholder `user` row with no credentials (so expenses, splits
 * and settlements can reference them like any member) plus a membership row
 * flagged `synthetic`. Guests can be renamed/recolored/removed by the owner.
 */
export async function addSyntheticMember(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return fail("notSignedIn");

  const parsed = addSyntheticMemberSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      (parsed.error.issues[0]?.message as ActionErrorCode) ?? "invalidInput",
    );
  }
  const { groupId, name, color } = parsed.data;

  const me = await getMembership(groupId, session.user.id);
  if (!me || me.removedAt) return fail("notAMember");
  if (me.role !== "owner") return fail("notGroupOwner");

  const takenRows = await db
    .select({ color: groupMembers.color })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  const taken = takenRows.map((r) => r.color).filter((c): c is string => !!c);

  const userId = crypto.randomUUID();
  await db.batch([
    db.insert(user).values({
      id: userId,
      name,
      // Placeholder address on a reserved TLD: satisfies the not-null unique
      // column but can never receive mail or be used to sign in.
      email: `guest-${userId}@guest.invalid`,
      emailVerified: false,
    }),
    db.insert(groupMembers).values({
      groupId,
      userId,
      name,
      color: color ?? pickMemberColor(taken, takenRows.length),
      synthetic: true,
    }),
  ]);

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/members`);
  return ok();
}

/**
 * Owner-only: move everything a guest member is involved in (expenses, splits,
 * settlements) to a signed-in member, then delete the guest. Balances are
 * preserved exactly.
 *
 * When both people share a split of the same expense the two rows are merged:
 * amounts always add up; percentage/share weights are summed; an "equal" split
 * can't express one person carrying two heads, so those expenses become
 * "shares" with weight 1 per member and 2 for the merged row. Settlements
 * between the two would become self-payments (which net to zero), so they are
 * dropped.
 */
export async function mergeSyntheticMember(
  input: unknown,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return fail("notSignedIn");

  const parsed = mergeSyntheticMemberSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      (parsed.error.issues[0]?.message as ActionErrorCode) ?? "invalidInput",
    );
  }
  const { groupId, guestId, targetUserId } = parsed.data;
  if (guestId === targetUserId) return fail("invalidInput");

  const me = await getMembership(groupId, session.user.id);
  if (!me || me.removedAt) return fail("notAMember");
  if (me.role !== "owner") return fail("notGroupOwner");

  const guest = await getMembership(groupId, guestId);
  if (!guest || !guest.synthetic) return fail("cannotEditMember");

  const target = await getMembership(groupId, targetUserId);
  if (!target || target.removedAt || target.synthetic) {
    return fail("transferTargetInvalid");
  }

  // The guest exists only in this group, so these splits are all of them.
  const guestSplits = await db
    .select({
      id: expenseSplits.id,
      expenseId: expenseSplits.expenseId,
      amount: expenseSplits.amount,
      shareValue: expenseSplits.shareValue,
      splitType: expenses.splitType,
    })
    .from(expenseSplits)
    .innerJoin(expenses, eq(expenses.id, expenseSplits.expenseId))
    .where(
      and(eq(expenses.groupId, groupId), eq(expenseSplits.userId, guestId)),
    );

  const expenseIds = guestSplits.map((s) => s.expenseId);
  const targetSplits = expenseIds.length
    ? await db
        .select()
        .from(expenseSplits)
        .where(
          and(
            inArray(expenseSplits.expenseId, expenseIds),
            eq(expenseSplits.userId, targetUserId),
          ),
        )
    : [];
  const targetByExpense = new Map(targetSplits.map((s) => [s.expenseId, s]));

  const equalOverlapIds = guestSplits
    .filter((s) => s.splitType === "equal" && targetByExpense.has(s.expenseId))
    .map((s) => s.expenseId);
  const equalOverlapSplits = equalOverlapIds.length
    ? await db
        .select()
        .from(expenseSplits)
        .where(inArray(expenseSplits.expenseId, equalOverlapIds))
    : [];

  const stmts: BatchItem<"pg">[] = [];

  for (const s of guestSplits) {
    const t = targetByExpense.get(s.expenseId);
    if (!t) {
      stmts.push(
        db
          .update(expenseSplits)
          .set({ userId: targetUserId })
          .where(eq(expenseSplits.id, s.id)),
      );
      continue;
    }
    let shareValue: string | null = null;
    if (s.splitType === "percentage" || s.splitType === "shares") {
      shareValue = String(Number(t.shareValue ?? 0) + Number(s.shareValue ?? 0));
    } else if (s.splitType === "equal") {
      shareValue = "2";
    }
    stmts.push(
      db
        .update(expenseSplits)
        .set({ amount: t.amount + s.amount, shareValue })
        .where(eq(expenseSplits.id, t.id)),
      db.delete(expenseSplits).where(eq(expenseSplits.id, s.id)),
    );
  }

  // Equal-to-shares conversion: everyone else keeps weight 1.
  for (const es of equalOverlapSplits) {
    if (es.userId === guestId || es.userId === targetUserId) continue;
    stmts.push(
      db
        .update(expenseSplits)
        .set({ shareValue: "1" })
        .where(eq(expenseSplits.id, es.id)),
    );
  }
  if (equalOverlapIds.length) {
    stmts.push(
      db
        .update(expenses)
        .set({ splitType: "shares" })
        .where(inArray(expenses.id, equalOverlapIds)),
    );
  }

  // Receipt breakdowns store assignee ids in JSON; repoint them too so the
  // receipt editor keeps resolving. Both assigned to one item dedupes to one.
  const receiptRows = await db
    .select({ id: expenses.id, receipt: expenses.receipt })
    .from(expenses)
    .where(and(eq(expenses.groupId, groupId), isNotNull(expenses.receipt)));
  for (const r of receiptRows) {
    if (!r.receipt?.items.some((i) => i.assignees.includes(guestId))) continue;
    const receipt = {
      ...r.receipt,
      items: r.receipt.items.map((i) => ({
        ...i,
        assignees: [
          ...new Set(
            i.assignees.map((a) => (a === guestId ? targetUserId : a)),
          ),
        ],
      })),
    };
    stmts.push(
      db.update(expenses).set({ receipt }).where(eq(expenses.id, r.id)),
    );
  }

  stmts.push(
    db
      .update(expenses)
      .set({ paidBy: targetUserId })
      .where(and(eq(expenses.groupId, groupId), eq(expenses.paidBy, guestId))),
    db
      .update(expenses)
      .set({ createdBy: targetUserId })
      .where(
        and(eq(expenses.groupId, groupId), eq(expenses.createdBy, guestId)),
      ),
    db
      .delete(settlements)
      .where(
        and(
          eq(settlements.groupId, groupId),
          or(
            and(
              eq(settlements.fromUserId, guestId),
              eq(settlements.toUserId, targetUserId),
            ),
            and(
              eq(settlements.fromUserId, targetUserId),
              eq(settlements.toUserId, guestId),
            ),
          ),
        ),
      ),
    db
      .update(settlements)
      .set({ fromUserId: targetUserId })
      .where(
        and(
          eq(settlements.groupId, groupId),
          eq(settlements.fromUserId, guestId),
        ),
      ),
    db
      .update(settlements)
      .set({ toUserId: targetUserId })
      .where(
        and(
          eq(settlements.groupId, groupId),
          eq(settlements.toUserId, guestId),
        ),
      ),
    db
      .update(settlements)
      .set({ createdBy: targetUserId })
      .where(
        and(
          eq(settlements.groupId, groupId),
          eq(settlements.createdBy, guestId),
        ),
      ),
    // Nothing references the placeholder user anymore; deleting it cascades
    // the guest's membership row.
    db.delete(user).where(eq(user.id, guestId)),
  );

  await db.batch(stmts as [BatchItem<"pg">, ...BatchItem<"pg">[]]);

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/members`);
  revalidatePath("/dashboard");
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

/**
 * Leave a group yourself. Same soft-removal as being removed by the owner: the
 * membership is marked removed so expenses/splits keep resolving, but access is
 * revoked. The owner can't leave (it would orphan owner-only controls).
 */
export async function leaveGroup(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return fail("notSignedIn");

  const parsed = leaveGroupSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      (parsed.error.issues[0]?.message as ActionErrorCode) ?? "invalidInput",
    );
  }
  const { groupId } = parsed.data;

  const me = await getMembership(groupId, session.user.id);
  if (!me || me.removedAt) return fail("notAMember");
  if (me.role === "owner") return fail("ownerCannotLeave");

  const result = await db
    .update(groupMembers)
    .set({ removedAt: new Date() })
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, session.user.id),
        isNull(groupMembers.removedAt),
      ),
    )
    .returning({ id: groupMembers.id });

  if (result.length === 0) return fail("notAMember");

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/dashboard");
  return ok();
}

/** Change your own accent color (or, as the owner, a guest member's). */
export async function updateMemberColor(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return fail("notSignedIn");

  const parsed = updateMemberColorSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      (parsed.error.issues[0]?.message as ActionErrorCode) ?? "invalidInput",
    );
  }
  const { groupId, color, userId } = parsed.data;

  const target = await resolveEditTarget(groupId, session.user.id, userId);
  if (!target.ok) return fail(target.error);

  const result = await db
    .update(groupMembers)
    .set({ color })
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, target.targetId),
      ),
    )
    .returning({ id: groupMembers.id });

  if (result.length === 0) return fail("notAMember");

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/members`);
  return ok();
}

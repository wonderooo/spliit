"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { settlements } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getGroup, getGroupMembers, getMembership } from "@/lib/queries";
import { settlementSchema } from "@/lib/validators";
import { toMinorUnits, convertMinorUnits } from "@/lib/currency";
import { ok, fail, type ActionResult } from "@/lib/action-result";

export async function recordSettlement(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return fail("You must be signed in.");

  const parsed = settlementSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  if (data.fromUserId === data.toUserId) {
    return fail("Payer and recipient must be different people.");
  }

  const membership = await getMembership(data.groupId, session.user.id);
  if (!membership) return fail("You are not a member of this group.");

  const group = await getGroup(data.groupId);
  if (!group) return fail("Group not found.");

  const members = await getGroupMembers(data.groupId);
  const memberIds = new Set(members.map((m) => m.id));
  if (!memberIds.has(data.fromUserId) || !memberIds.has(data.toUserId)) {
    return fail("Both people must be group members.");
  }

  const amountMinor = toMinorUnits(data.amount, data.currency);
  const baseAmount = convertMinorUnits(
    amountMinor,
    data.fxRate,
    data.currency,
    group.baseCurrency,
  );

  await db.insert(settlements).values({
    groupId: data.groupId,
    fromUserId: data.fromUserId,
    toUserId: data.toUserId,
    amount: amountMinor,
    currency: data.currency,
    fxRate: String(data.fxRate),
    baseAmount,
    date: data.date,
    note: data.note || null,
  });

  revalidatePath(`/groups/${data.groupId}`);
  revalidatePath("/dashboard");
  return ok();
}

export async function deleteSettlement(
  settlementId: string,
  groupId: string,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return fail("You must be signed in.");

  const membership = await getMembership(groupId, session.user.id);
  if (!membership) return fail("You are not a member of this group.");

  await db.delete(settlements).where(eq(settlements.id, settlementId));

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/dashboard");
  return ok();
}

"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { expenses, expenseSplits } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getGroup, getGroupMembers, getMembership } from "@/lib/queries";
import { createExpenseSchema } from "@/lib/validators";
import { toMinorUnits, convertMinorUnits } from "@/lib/currency";
import { computeSplits } from "@/lib/splits";
import {
  ok,
  fail,
  type ActionResult,
  type ActionErrorCode,
} from "@/lib/action-result";

export async function createExpense(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return fail("notSignedIn");

  const parsed = createExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return fail((parsed.error.issues[0]?.message as ActionErrorCode) ?? "invalidInput");
  }
  const data = parsed.data;

  const membership = await getMembership(data.groupId, session.user.id);
  if (!membership) return fail("notAMember");

  const group = await getGroup(data.groupId);
  if (!group) return fail("groupNotFound");

  const members = await getGroupMembers(data.groupId);
  const memberIds = new Set(members.map((m) => m.id));
  if (!memberIds.has(data.paidBy)) {
    return fail("payerNotMember");
  }
  if (!data.splits.every((s) => memberIds.has(s.userId))) {
    return fail("participantsNotMembers");
  }

  // Amount in minor units of the expense currency.
  const totalMinor = toMinorUnits(data.amount, data.currency);

  // For exact splits the entered values are major units -> convert to minor.
  const participants =
    data.splitType === "exact"
      ? data.splits.map((s) => ({
          userId: s.userId,
          value: toMinorUnits(s.value ?? 0, data.currency),
        }))
      : data.splits;

  let computed;
  try {
    computed = computeSplits(totalMinor, data.splitType, participants);
  } catch (e) {
    return fail((e instanceof Error ? (e.message as ActionErrorCode) : "unknown"));
  }

  const baseAmount = convertMinorUnits(
    totalMinor,
    data.fxRate,
    data.currency,
    group.baseCurrency,
  );

  const expenseId = crypto.randomUUID();

  await db.batch([
    db.insert(expenses).values({
      id: expenseId,
      groupId: data.groupId,
      description: data.description,
      category: data.category || null,
      amount: totalMinor,
      currency: data.currency,
      paidBy: data.paidBy,
      splitType: data.splitType,
      fxRate: String(data.fxRate),
      baseAmount,
      date: data.date,
      personal: data.personal,
      receipt: data.receipt ?? null,
      createdBy: session.user.id,
    }),
    db.insert(expenseSplits).values(
      computed.map((c) => ({
        expenseId,
        userId: c.userId,
        amount: c.amount,
        shareValue: c.shareValue === null ? null : String(c.shareValue),
      })),
    ),
  ]);

  revalidatePath(`/groups/${data.groupId}`);
  revalidatePath("/dashboard");
  return ok();
}

export async function updateExpense(
  expenseId: string,
  input: unknown,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return fail("notSignedIn");

  const parsed = createExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return fail((parsed.error.issues[0]?.message as ActionErrorCode) ?? "invalidInput");
  }
  const data = parsed.data;

  const membership = await getMembership(data.groupId, session.user.id);
  if (!membership) return fail("notAMember");

  const group = await getGroup(data.groupId);
  if (!group) return fail("groupNotFound");

  const existing = await db
    .select({
      id: expenses.id,
      personal: expenses.personal,
      paidBy: expenses.paidBy,
    })
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.groupId, data.groupId)))
    .limit(1);
  if (existing.length === 0) return fail("expenseNotFound");

  // A personal ("own") expense can only be changed by the person it belongs to.
  if (existing[0].personal && existing[0].paidBy !== session.user.id) {
    return fail("notExpenseOwner");
  }

  const members = await getGroupMembers(data.groupId);
  const memberIds = new Set(members.map((m) => m.id));
  if (!memberIds.has(data.paidBy)) {
    return fail("payerNotMember");
  }
  if (!data.splits.every((s) => memberIds.has(s.userId))) {
    return fail("participantsNotMembers");
  }

  const totalMinor = toMinorUnits(data.amount, data.currency);

  const participants =
    data.splitType === "exact"
      ? data.splits.map((s) => ({
          userId: s.userId,
          value: toMinorUnits(s.value ?? 0, data.currency),
        }))
      : data.splits;

  let computed;
  try {
    computed = computeSplits(totalMinor, data.splitType, participants);
  } catch (e) {
    return fail((e instanceof Error ? (e.message as ActionErrorCode) : "unknown"));
  }

  const baseAmount = convertMinorUnits(
    totalMinor,
    data.fxRate,
    data.currency,
    group.baseCurrency,
  );

  await db.batch([
    db
      .update(expenses)
      .set({
        description: data.description,
        category: data.category || null,
        amount: totalMinor,
        currency: data.currency,
        paidBy: data.paidBy,
        splitType: data.splitType,
        fxRate: String(data.fxRate),
        baseAmount,
        date: data.date,
        personal: data.personal,
        // Only the receipt editor sends `receipt`; a manual edit omits it and
        // leaves any existing breakdown intact.
        ...(data.receipt !== undefined ? { receipt: data.receipt } : {}),
      })
      .where(eq(expenses.id, expenseId)),
    db.delete(expenseSplits).where(eq(expenseSplits.expenseId, expenseId)),
    db.insert(expenseSplits).values(
      computed.map((c) => ({
        expenseId,
        userId: c.userId,
        amount: c.amount,
        shareValue: c.shareValue === null ? null : String(c.shareValue),
      })),
    ),
  ]);

  revalidatePath(`/groups/${data.groupId}`);
  revalidatePath("/dashboard");
  return ok();
}

export async function deleteExpense(
  expenseId: string,
  groupId: string,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return fail("notSignedIn");

  const membership = await getMembership(groupId, session.user.id);
  if (!membership) return fail("notAMember");

  const existing = await db
    .select({ personal: expenses.personal, paidBy: expenses.paidBy })
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.groupId, groupId)))
    .limit(1);
  if (existing.length === 0) return fail("expenseNotFound");

  // A personal ("own") expense can only be deleted by the person it belongs to.
  if (existing[0].personal && existing[0].paidBy !== session.user.id) {
    return fail("notExpenseOwner");
  }

  await db.delete(expenses).where(eq(expenses.id, expenseId));

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/dashboard");
  return ok();
}

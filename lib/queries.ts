import "server-only";
import { and, countDistinct, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  groups,
  groupMembers,
  expenses,
  expenseSplits,
  settlements,
  invitations,
  user as userTable,
  type ReceiptData,
} from "@/lib/db/schema";
import {
  computeNetBalances,
  simplifyDebts,
  type BalanceExpense,
  type BalanceSettlement,
} from "@/lib/balances";

export type MemberUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  /** Per-group accent color key (see lib/member-colors), or null if unassigned. */
  color: string | null;
  /** True when the owner removed this member (their data is kept regardless). */
  removed: boolean;
};

/** The membership row for a user in a group, or null if they're not a member. */
export async function getMembership(groupId: string, userId: string) {
  const rows = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** All groups the user belongs to, newest first. */
export async function getUserGroups(userId: string) {
  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      description: groups.description,
      baseCurrency: groups.baseCurrency,
      createdAt: groups.createdAt,
    })
    .from(groups)
    .innerJoin(groupMembers, eq(groupMembers.groupId, groups.id))
    .where(and(eq(groupMembers.userId, userId), isNull(groupMembers.removedAt)))
    .orderBy(desc(groups.createdAt));
  return rows;
}

export async function getGroup(groupId: string) {
  const rows = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getGroupMembers(groupId: string): Promise<MemberUser[]> {
  const rows = await db
    .select({
      id: userTable.id,
      // Per-group display name when set, otherwise the user's account name.
      name: sql<string>`coalesce(${groupMembers.name}, ${userTable.name})`,
      email: userTable.email,
      image: userTable.image,
      color: groupMembers.color,
      removed: sql<boolean>`${groupMembers.removedAt} is not null`,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(userTable, eq(userTable.id, groupMembers.userId))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(groupMembers.joinedAt);
  return rows;
}

export type ExpenseWithSplits = {
  id: string;
  description: string;
  category: string | null;
  amount: number;
  currency: string;
  paidBy: string;
  splitType: string;
  fxRate: string;
  baseAmount: number;
  date: string;
  createdAt: Date;
  receipt: ReceiptData | null;
  splits: { userId: string; amount: number; shareValue: string | null }[];
};

export async function getGroupExpenses(
  groupId: string,
): Promise<ExpenseWithSplits[]> {
  const expenseRows = await db
    .select()
    .from(expenses)
    .where(eq(expenses.groupId, groupId))
    .orderBy(desc(expenses.date), desc(expenses.createdAt));

  if (expenseRows.length === 0) return [];

  // Fetch all splits for this group's expenses in one query.
  const allSplits = await db
    .select()
    .from(expenseSplits)
    .innerJoin(expenses, eq(expenses.id, expenseSplits.expenseId))
    .where(eq(expenses.groupId, groupId));

  const byExpense = new Map<
    string,
    { userId: string; amount: number; shareValue: string | null }[]
  >();
  for (const row of allSplits) {
    const s = row.expense_splits;
    const list = byExpense.get(s.expenseId) ?? [];
    list.push({
      userId: s.userId,
      amount: s.amount,
      shareValue: s.shareValue,
    });
    byExpense.set(s.expenseId, list);
  }

  return expenseRows.map((e) => ({
    ...e,
    splits: byExpense.get(e.id) ?? [],
  }));
}

/** Context for the public /invite/[token] page: which group, who invited you,
 *  and whether the link is still usable. Returns null for unknown tokens. */
export async function getInviteContext(token: string) {
  const rows = await db
    .select({
      status: invitations.status,
      expiresAt: invitations.expiresAt,
      groupId: invitations.groupId,
      groupName: groups.name,
      groupDescription: groups.description,
      baseCurrency: groups.baseCurrency,
      inviterName: userTable.name,
    })
    .from(invitations)
    .innerJoin(groups, eq(groups.id, invitations.groupId))
    .innerJoin(userTable, eq(userTable.id, invitations.invitedBy))
    .where(eq(invitations.token, token))
    .limit(1);

  const invite = rows[0];
  if (!invite) return null;

  const [{ count: memberCount }] = await db
    .select({ count: countDistinct(groupMembers.userId) })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, invite.groupId));

  const expired = invite.expiresAt.getTime() < Date.now();
  const usable = invite.status !== "revoked" && !expired;

  return {
    groupName: invite.groupName,
    groupDescription: invite.groupDescription,
    baseCurrency: invite.baseCurrency,
    inviterName: invite.inviterName,
    memberCount,
    status: invite.status,
    expired,
    usable,
  };
}

export async function getPendingInvitations(groupId: string) {
  return db
    .select()
    .from(invitations)
    .where(
      and(eq(invitations.groupId, groupId), eq(invitations.status, "pending")),
    )
    .orderBy(desc(invitations.createdAt));
}

export async function getGroupSettlements(groupId: string) {
  return db
    .select()
    .from(settlements)
    .where(eq(settlements.groupId, groupId))
    .orderBy(desc(settlements.date), desc(settlements.createdAt));
}

export type GroupBalances = {
  net: Map<string, number>;
  transactions: ReturnType<typeof simplifyDebts>;
};

/** Compute net balances + simplified settle-up plan for a group. */
export async function getGroupBalances(
  groupId: string,
): Promise<GroupBalances> {
  const [exp, setl] = await Promise.all([
    getGroupExpenses(groupId),
    getGroupSettlements(groupId),
  ]);

  const balanceExpenses: BalanceExpense[] = exp.map((e) => ({
    paidBy: e.paidBy,
    baseAmount: e.baseAmount,
    splits: e.splits.map((s) => ({ userId: s.userId, amount: s.amount })),
  }));

  const balanceSettlements: BalanceSettlement[] = setl.map((s) => ({
    fromUserId: s.fromUserId,
    toUserId: s.toUserId,
    baseAmount: s.baseAmount,
  }));

  const net = computeNetBalances(balanceExpenses, balanceSettlements);
  const transactions = simplifyDebts(net);
  return { net, transactions };
}

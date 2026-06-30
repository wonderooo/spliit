"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invitations, groupMembers } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getMembership } from "@/lib/queries";
import { inviteSchema } from "@/lib/validators";
import { ok, fail, type ActionResult } from "@/lib/action-result";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createInvite(
  input: unknown,
): Promise<ActionResult<{ token: string }>> {
  const session = await getSession();
  if (!session?.user) return fail("You must be signed in.");

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { groupId, email } = parsed.data;

  const membership = await getMembership(groupId, session.user.id);
  if (!membership) return fail("You are not a member of this group.");

  const token = crypto.randomUUID();
  await db.insert(invitations).values({
    groupId,
    email: email || null,
    token,
    invitedBy: session.user.id,
    status: "pending",
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });

  revalidatePath(`/groups/${groupId}/members`);
  return ok({ token });
}

export async function acceptInvite(
  token: string,
): Promise<ActionResult<{ groupId: string; alreadyMember: boolean }>> {
  const session = await getSession();
  if (!session?.user) return fail("You must be signed in.");

  const rows = await db
    .select()
    .from(invitations)
    .where(eq(invitations.token, token))
    .limit(1);

  const invite = rows[0];
  if (!invite) return fail("This invite link is invalid.");
  if (invite.status === "revoked") return fail("This invite has been revoked.");
  // An open (email-less) link stays "pending" so the whole crew can join with
  // the same URL. Only an email-scoped invite flips to "accepted" once its one
  // recipient joins — so "accepted" is the only status that closes a link.
  if (invite.status === "accepted")
    return fail("This invite has already been used.");
  if (invite.expiresAt.getTime() < Date.now()) {
    return fail("This invite link has expired.");
  }

  // Email-scoped invite: only the addressed account may accept it.
  if (
    invite.email &&
    invite.email.toLowerCase() !== session.user.email.toLowerCase()
  ) {
    return fail("This invite was sent to a different email address.");
  }

  const existing = await getMembership(invite.groupId, session.user.id);
  if (existing) {
    // Already in the group — a no-op. Don't consume the link or claim a join.
    return ok({ groupId: invite.groupId, alreadyMember: true });
  }

  await db.insert(groupMembers).values({
    groupId: invite.groupId,
    userId: session.user.id,
    role: "member",
  });

  // Targeted invites are single-use; open links stay reusable.
  if (invite.email) {
    await db
      .update(invitations)
      .set({ status: "accepted" })
      .where(eq(invitations.id, invite.id));
  }

  revalidatePath("/dashboard");
  revalidatePath(`/groups/${invite.groupId}`);
  return ok({ groupId: invite.groupId, alreadyMember: false });
}

export async function revokeInvite(
  inviteId: string,
  groupId: string,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return fail("You must be signed in.");

  const membership = await getMembership(groupId, session.user.id);
  if (!membership) return fail("You are not a member of this group.");

  await db
    .update(invitations)
    .set({ status: "revoked" })
    .where(and(eq(invitations.id, inviteId), eq(invitations.groupId, groupId)));

  revalidatePath(`/groups/${groupId}/members`);
  return ok();
}

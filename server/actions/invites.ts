"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invitations, groupMembers } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getMembership } from "@/lib/queries";
import {
  inviteSchema,
  memberNameSchema,
  memberColorSchema,
} from "@/lib/validators";
import { pickMemberColor } from "@/lib/member-colors";
import {
  ok,
  fail,
  type ActionResult,
  type ActionErrorCode,
} from "@/lib/action-result";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createInvite(
  input: unknown,
): Promise<ActionResult<{ token: string }>> {
  const session = await getSession();
  if (!session?.user) return fail("notSignedIn");

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return fail((parsed.error.issues[0]?.message as ActionErrorCode) ?? "invalidInput");
  }
  const { groupId, email } = parsed.data;

  const membership = await getMembership(groupId, session.user.id);
  if (!membership) return fail("notAMember");

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
  name?: string,
  color?: string,
): Promise<ActionResult<{ groupId: string; alreadyMember: boolean }>> {
  const session = await getSession();
  if (!session?.user) return fail("notSignedIn");

  // The display name is optional; fall back to the account name when absent.
  let memberName: string | null = null;
  if (name !== undefined && name.trim() !== "") {
    const parsedName = memberNameSchema.safeParse(name);
    if (!parsedName.success) {
      return fail((parsedName.error.issues[0]?.message as ActionErrorCode) ?? "invalidInput");
    }
    memberName = parsedName.data;
  }

  // The accent color is optional too; a valid choice wins, else auto-assign.
  const chosenColor = memberColorSchema.safeParse(color);

  const rows = await db
    .select()
    .from(invitations)
    .where(eq(invitations.token, token))
    .limit(1);

  const invite = rows[0];
  if (!invite) return fail("inviteInvalid");
  if (invite.status === "revoked") return fail("inviteRevoked");
  // An open (email-less) link stays "pending" so the whole crew can join with
  // the same URL. Only an email-scoped invite flips to "accepted" once its one
  // recipient joins — so "accepted" is the only status that closes a link.
  if (invite.status === "accepted")
    return fail("inviteUsed");
  if (invite.expiresAt.getTime() < Date.now()) {
    return fail("inviteExpired");
  }

  // Email-scoped invite: only the addressed account may accept it.
  if (
    invite.email &&
    invite.email.toLowerCase() !== session.user.email.toLowerCase()
  ) {
    return fail("inviteWrongEmail");
  }

  const existing = await getMembership(invite.groupId, session.user.id);
  if (existing && !existing.removedAt) {
    // Already an active member — a no-op. Don't consume the link or claim a join.
    return ok({ groupId: invite.groupId, alreadyMember: true });
  }

  // Prefer the member's pick; otherwise auto-assign a color not already used
  // by someone else in the group.
  const takenRows = await db
    .select({ color: groupMembers.color })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, invite.groupId));
  const taken = takenRows.map((r) => r.color).filter((c): c is string => !!c);

  if (existing) {
    // Previously removed: reactivate the same row (the (group, user) pair is
    // unique, so we can't insert a second one). Keep their old name/color
    // unless a new choice was made.
    await db
      .update(groupMembers)
      .set({
        removedAt: null,
        ...(memberName !== null ? { name: memberName } : {}),
        color: chosenColor.success
          ? chosenColor.data
          : (existing.color ?? pickMemberColor(taken)),
      })
      .where(
        and(
          eq(groupMembers.groupId, invite.groupId),
          eq(groupMembers.userId, session.user.id),
        ),
      );
  } else {
    await db.insert(groupMembers).values({
      groupId: invite.groupId,
      userId: session.user.id,
      name: memberName,
      color: chosenColor.success ? chosenColor.data : pickMemberColor(taken),
      role: "member",
    });
  }

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
  if (!session?.user) return fail("notSignedIn");

  const membership = await getMembership(groupId, session.user.id);
  if (!membership) return fail("notAMember");

  await db
    .update(invitations)
    .set({ status: "revoked" })
    .where(and(eq(invitations.id, inviteId), eq(invitations.groupId, groupId)));

  revalidatePath(`/groups/${groupId}/members`);
  return ok();
}

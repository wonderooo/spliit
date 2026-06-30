import { requireUser } from "@/lib/session";
import {
  getGroup,
  getGroupMembers,
  getPendingInvitations,
} from "@/lib/queries";
import { MembersPanel } from "@/components/members-panel";

export const dynamic = "force-dynamic";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const [group, members, invites] = await Promise.all([
    getGroup(id),
    getGroupMembers(id),
    getPendingInvitations(id),
  ]);
  if (!group) return null;

  return (
    <MembersPanel
      groupId={id}
      members={members}
      invites={invites.map((i) => ({
        id: i.id,
        email: i.email,
        token: i.token,
      }))}
      currentUserId={user.id}
      ownerId={group.createdBy}
    />
  );
}

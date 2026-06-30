import { requireUser } from "@/lib/session";
import {
  getGroup,
  getGroupMembers,
  getGroupBalances,
  getGroupSettlements,
} from "@/lib/queries";
import { SettleUp } from "@/components/settle-up";

export const dynamic = "force-dynamic";

export default async function SettlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const [group, members, { transactions }, settlements] = await Promise.all([
    getGroup(id),
    getGroupMembers(id),
    getGroupBalances(id),
    getGroupSettlements(id),
  ]);
  if (!group) return null;

  return (
    <SettleUp
      groupId={id}
      baseCurrency={group.baseCurrency}
      members={members}
      currentUserId={user.id}
      transactions={transactions}
      settlements={settlements.map((s) => ({
        id: s.id,
        fromUserId: s.fromUserId,
        toUserId: s.toUserId,
        amount: s.amount,
        currency: s.currency,
        baseAmount: s.baseAmount,
        date: s.date,
        note: s.note,
      }))}
    />
  );
}

import { requireUser } from "@/lib/session";
import {
  getGroup,
  getGroupExpenses,
  getGroupMembers,
} from "@/lib/queries";
import { ExpensesView } from "@/components/expenses-view";

export const dynamic = "force-dynamic";

export default async function GroupExpensesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const [group, members, expenses] = await Promise.all([
    getGroup(id),
    getGroupMembers(id),
    getGroupExpenses(id),
  ]);
  if (!group) return null;

  return (
    <ExpensesView
      groupId={id}
      baseCurrency={group.baseCurrency}
      members={members}
      currentUserId={user.id}
      expenses={expenses}
    />
  );
}

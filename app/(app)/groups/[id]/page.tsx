import { requireUser } from "@/lib/session";
import {
  getGroup,
  getGroupExpenses,
  getGroupMembers,
} from "@/lib/queries";
import { ExpenseForm } from "@/components/expense-form";
import { ExpenseList } from "@/components/expense-list";

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

  const names = Object.fromEntries(members.map((m) => [m.id, m.name]));

  return (
    <div className="flex flex-col gap-4">
      <ExpenseForm
        groupId={id}
        baseCurrency={group.baseCurrency}
        members={members}
        currentUserId={user.id}
      />
      <ExpenseList
        groupId={id}
        baseCurrency={group.baseCurrency}
        expenses={expenses}
        names={names}
        currentUserId={user.id}
      />
    </div>
  );
}

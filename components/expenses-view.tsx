"use client";

import { useState, useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createExpense,
  updateExpense,
  deleteExpense,
} from "@/server/actions/expenses";
import type { ExpenseWithSplits, MemberUser } from "@/lib/queries";
import type { CreateExpenseInput } from "@/lib/validators";
import { toMinorUnits, convertMinorUnits } from "@/lib/currency";
import { ExpenseForm } from "@/components/expense-form";
import { ExpenseList } from "@/components/expense-list";

type OptimisticAction =
  | { type: "add"; expense: ExpenseWithSplits }
  | { type: "update"; expense: ExpenseWithSplits }
  | { type: "delete"; id: string };

let tempSeq = 0;

export function ExpensesView({
  groupId,
  baseCurrency,
  members,
  currentUserId,
  expenses,
}: {
  groupId: string;
  baseCurrency: string;
  members: MemberUser[];
  currentUserId: string;
  expenses: ExpenseWithSplits[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<ExpenseWithSplits | null>(null);

  const [optimistic, applyOptimistic] = useOptimistic(
    expenses,
    (state, action: OptimisticAction) => {
      if (action.type === "add") return [action.expense, ...state];
      if (action.type === "update")
        return state.map((e) =>
          e.id === action.expense.id ? action.expense : e,
        );
      return state.filter((e) => e.id !== action.id);
    },
  );

  const names = Object.fromEntries(members.map((m) => [m.id, m.name]));

  function buildOptimistic(input: CreateExpenseInput): ExpenseWithSplits {
    let amountMinor = 0;
    try {
      amountMinor = toMinorUnits(input.amount, input.currency);
    } catch {
      amountMinor = 0;
    }
    const baseAmount = convertMinorUnits(
      amountMinor,
      input.fxRate,
      input.currency,
      baseCurrency,
    );
    return {
      id: `optimistic-${tempSeq++}`,
      description: input.description,
      category: input.category || null,
      amount: amountMinor,
      currency: input.currency,
      paidBy: input.paidBy,
      splitType: input.splitType,
      fxRate: String(input.fxRate),
      baseAmount,
      date: input.date,
      createdAt: new Date(),
      splits: [],
    };
  }

  // Returns the action result so the form can reset (or reopen on error).
  function submitExpense(input: CreateExpenseInput) {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      startTransition(async () => {
        applyOptimistic({ type: "add", expense: buildOptimistic(input) });
        const res = await createExpense(input);
        if (res.ok) {
          toast.success("Expense added");
          router.refresh();
          resolve({ ok: true });
        } else {
          resolve({ ok: false, error: res.error });
        }
      });
    });
  }

  function submitEdit(target: ExpenseWithSplits, input: CreateExpenseInput) {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      startTransition(async () => {
        applyOptimistic({
          type: "update",
          expense: {
            ...buildOptimistic(input),
            id: target.id,
            createdAt: target.createdAt,
          },
        });
        const res = await updateExpense(target.id, input);
        if (res.ok) {
          toast.success("Expense updated");
          setEditing(null);
          router.refresh();
          resolve({ ok: true });
        } else {
          resolve({ ok: false, error: res.error });
        }
      });
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      applyOptimistic({ type: "delete", id });
      const res = await deleteExpense(id, groupId);
      if (res.ok) {
        toast.success("Expense deleted");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <ExpenseForm
        groupId={groupId}
        baseCurrency={baseCurrency}
        members={members}
        currentUserId={currentUserId}
        onSubmitExpense={submitExpense}
      />
      <ExpenseList
        baseCurrency={baseCurrency}
        expenses={optimistic}
        names={names}
        currentUserId={currentUserId}
        onDelete={onDelete}
        onEdit={setEditing}
      />
      {editing && (
        <ExpenseForm
          key={editing.id}
          groupId={groupId}
          baseCurrency={baseCurrency}
          members={members}
          currentUserId={currentUserId}
          expense={editing}
          open={editing != null}
          onOpenChange={(o) => {
            if (!o) setEditing(null);
          }}
          onSubmitExpense={(input) => submitEdit(editing, input)}
        />
      )}
    </div>
  );
}

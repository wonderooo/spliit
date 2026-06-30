"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreVertical, Trash2, Receipt } from "lucide-react";
import { deleteExpense } from "@/server/actions/expenses";
import type { ExpenseWithSplits } from "@/lib/queries";
import { formatMoney } from "@/lib/currency";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SPLIT_LABEL: Record<string, string> = {
  equal: "equally",
  exact: "exact",
  percentage: "%",
  shares: "shares",
};

export function ExpenseList({
  groupId,
  baseCurrency,
  expenses,
  names,
  currentUserId,
}: {
  groupId: string;
  baseCurrency: string;
  expenses: ExpenseWithSplits[];
  names: Record<string, string>;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function nameOf(id: string) {
    return id === currentUserId ? "You" : (names[id] ?? "Someone");
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const res = await deleteExpense(id, groupId);
      if (res.ok) {
        toast.success("Expense deleted");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  if (expenses.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-10 text-center">
        <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Receipt className="size-6" />
        </div>
        <p className="font-semibold">No expenses yet</p>
        <p className="text-sm text-muted-foreground">
          Add your first expense to start tracking who owes what.
        </p>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {expenses.map((e) => {
        const foreign = e.currency !== baseCurrency;
        return (
          <li key={e.id}>
            <Card className="flex-row items-center gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{e.description}</p>
                  {e.category ? (
                    <Badge variant="secondary" className="shrink-0">
                      {e.category}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {nameOf(e.paidBy)} paid · {e.date} ·{" "}
                  {SPLIT_LABEL[e.splitType] ?? e.splitType}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">
                  {formatMoney(e.amount, e.currency)}
                </p>
                {foreign ? (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatMoney(e.baseAmount, baseCurrency)}
                  </p>
                ) : null}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Expense actions"
                >
                  <MoreVertical className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={pending}
                    onClick={() => onDelete(e.id)}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

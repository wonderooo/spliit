"use client";

import { useState } from "react";
import { MoreVertical, Pencil, Trash2, Receipt } from "lucide-react";
import type { ExpenseWithSplits } from "@/lib/queries";
import { formatMoney } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SPLIT_LABEL: Record<string, string> = {
  equal: "equally",
  exact: "exact",
  percentage: "%",
  shares: "shares",
};

export function ExpenseList({
  baseCurrency,
  expenses,
  names,
  currentUserId,
  onDelete,
  onEdit,
}: {
  baseCurrency: string;
  expenses: ExpenseWithSplits[];
  names: Record<string, string>;
  currentUserId: string;
  onDelete: (id: string) => void;
  onEdit: (expense: ExpenseWithSplits) => void;
}) {
  const [toDelete, setToDelete] = useState<ExpenseWithSplits | null>(null);

  function nameOf(id: string) {
    return id === currentUserId ? "You" : (names[id] ?? "Someone");
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
    <>
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
                  <DropdownMenuItem onClick={() => onEdit(e)}>
                    <Pencil className="size-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setToDelete(e)}
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

      <Dialog
        open={toDelete != null}
        onOpenChange={(o) => {
          if (!o) setToDelete(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this expense?</DialogTitle>
            <DialogDescription>
              {toDelete ? (
                <>
                  &ldquo;{toDelete.description}&rdquo; (
                  {formatMoney(toDelete.amount, toDelete.currency)}) will be
                  removed for everyone. This can&apos;t be undone.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (toDelete) onDelete(toDelete.id);
                setToDelete(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

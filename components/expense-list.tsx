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
import { useT } from "@/components/i18n-provider";
import { format } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";

function splitLabel(t: Dictionary): Record<string, string> {
  return {
    equal: t.expenseList.splitEqually,
    exact: t.expenseList.splitExact,
    percentage: "%",
    shares: t.expenseList.splitShares,
  };
}

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
  const t = useT();
  const SPLIT_LABEL = splitLabel(t);
  const [toDelete, setToDelete] = useState<ExpenseWithSplits | null>(null);

  function nameOf(id: string) {
    return id === currentUserId ? t.common.you : (names[id] ?? t.expenseList.someone);
  }

  if (expenses.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-10 text-center">
        <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Receipt className="size-6" />
        </div>
        <p className="font-semibold">{t.expenseList.emptyTitle}</p>
        <p className="text-sm text-muted-foreground">
          {t.expenseList.emptyBody}
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
                  {format(t.expenseList.paidBy, { name: nameOf(e.paidBy) })} ·{" "}
                  {e.date} · {SPLIT_LABEL[e.splitType] ?? e.splitType}
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
                  aria-label={t.expenseList.actions}
                >
                  <MoreVertical className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(e)}>
                    <Pencil className="size-4" />
                    {t.expenseList.edit}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setToDelete(e)}
                  >
                    <Trash2 className="size-4" />
                    {t.expenseList.delete}
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
            <DialogTitle>{t.expenseList.deleteTitle}</DialogTitle>
            <DialogDescription>
              {toDelete
                ? format(t.expenseList.deleteBody, {
                    description: toDelete.description,
                    amount: formatMoney(toDelete.amount, toDelete.currency),
                  })
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setToDelete(null)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (toDelete) onDelete(toDelete.id);
                setToDelete(null);
              }}
            >
              {t.expenseList.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

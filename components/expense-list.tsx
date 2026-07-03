"use client";

import { useState } from "react";
import { MoreVertical, Pencil, Trash2, Receipt, Wallet } from "lucide-react";
import type { ExpenseWithSplits } from "@/lib/queries";
import { formatMoney } from "@/lib/currency";
import { memberColorStyle } from "@/lib/member-colors";
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
import { cn } from "@/lib/utils";

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
    colors,
    removed,
    currentUserId,
    onDelete,
    onEdit,
    onEditReceipt,
}: {
    baseCurrency: string;
    expenses: ExpenseWithSplits[];
    names: Record<string, string>;
    colors: Record<string, string | null>;
    removed: Record<string, boolean>;
    currentUserId: string;
    onDelete: (id: string) => void;
    onEdit: (expense: ExpenseWithSplits) => void;
    onEditReceipt: (expense: ExpenseWithSplits) => void;
}) {
    const t = useT();
    const SPLIT_LABEL = splitLabel(t);
    const [toDelete, setToDelete] = useState<ExpenseWithSplits | null>(null);

    function nameOf(id: string) {
        return id === currentUserId
            ? t.common.you
            : (names[id] ?? t.expenseList.someone);
    }

    /** The "{name} paid" line with just the payer name in their accent color.
     *  Removed members read as inactive via a strikethrough on their name. */
    function paidByLine(id: string) {
        const label = format(t.expenseList.paidBy, { name: nameOf(id) });
        const name = nameOf(id);
        const style = memberColorStyle(colors[id]);
        const isRemoved = removed[id];
        const at = label.indexOf(name);
        if (at < 0 || (!style && !isRemoved)) return label;
        return (
            <>
                {label.slice(0, at)}
                <span
                    style={style}
                    className={cn(isRemoved && "line-through")}
                >
                    {name}
                </span>
                {label.slice(at + name.length)}
            </>
        );
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
                    // A personal ("own") expense can only be edited or deleted
                    // by the person it belongs to.
                    const canModify = !e.personal || e.paidBy === currentUserId;
                    return (
                        <li key={e.id}>
                            <Card className="flex-row items-center gap-3 p-3.5">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="truncate font-medium">
                                            {e.description}
                                        </p>
                                        {e.receipt ? (
                                            <Badge className="shrink-0 gap-0.5 border-transparent bg-emerald-500/15 py-1 px-1.5 text-emerald-700 dark:text-emerald-400">
                                                <Receipt />
                                                {t.expenseList.receiptBadge}
                                            </Badge>
                                        ) : null}
                                        {e.personal ? (
                                            <Badge className="shrink-0 gap-0.5 border-transparent bg-violet-500/15 py-1 px-1.5 text-violet-700 dark:text-violet-400">
                                                <Wallet />
                                                {t.expenseList.personalBadge}
                                            </Badge>
                                        ) : null}
                                        {e.category ? (
                                            <Badge
                                                variant="secondary"
                                                className="shrink-0"
                                            >
                                                {e.category}
                                            </Badge>
                                        ) : null}
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {paidByLine(e.paidBy)} ·{" "}
                                        <span className="whitespace-nowrap">
                                            {e.date}
                                        </span>
                                        {e.personal
                                            ? ""
                                            : ` · ${SPLIT_LABEL[e.splitType] ?? e.splitType}`}
                                        {/* Creator only when someone else
                                            entered the expense; otherwise the
                                            payer line already says it. */}
                                        {e.createdBy !== e.paidBy ? (
                                            <>
                                                {" · "}
                                                {e.createdBy === currentUserId
                                                    ? t.expenseList.addedByYou
                                                    : format(
                                                          t.expenseList
                                                              .addedBy,
                                                          {
                                                              name: nameOf(
                                                                  e.createdBy,
                                                              ),
                                                          },
                                                      )}
                                            </>
                                        ) : null}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold tabular-nums">
                                        {formatMoney(e.amount, e.currency)}
                                    </p>
                                    {foreign ? (
                                        <p className="text-xs text-muted-foreground tabular-nums">
                                            {formatMoney(
                                                e.baseAmount,
                                                baseCurrency,
                                            )}
                                        </p>
                                    ) : null}
                                </div>
                                {canModify ? (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger
                                            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                                            aria-label={t.expenseList.actions}
                                        >
                                            <MoreVertical className="size-4" />
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onClick={() => onEdit(e)}
                                            >
                                                <Pencil className="size-4" />
                                                {t.expenseList.edit}
                                            </DropdownMenuItem>
                                            {e.receipt ? (
                                                <DropdownMenuItem
                                                    onClick={() =>
                                                        onEditReceipt(e)
                                                    }
                                                >
                                                    <Receipt className="size-4" />
                                                    {t.expenseList.editItems}
                                                </DropdownMenuItem>
                                            ) : null}
                                            <DropdownMenuItem
                                                variant="destructive"
                                                onClick={() => setToDelete(e)}
                                            >
                                                <Trash2 className="size-4" />
                                                {t.expenseList.delete}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                ) : null}
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
                                      amount: formatMoney(
                                          toDelete.amount,
                                          toDelete.currency,
                                      ),
                                  })
                                : null}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setToDelete(null)}
                        >
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

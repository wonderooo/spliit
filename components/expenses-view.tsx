"use client";

import { useState, useMemo, useOptimistic, useTransition } from "react";
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
import { ReceiptScanner, type ScanResult } from "@/components/receipt-scanner";
import { ExpenseList } from "@/components/expense-list";
import {
  ExpenseFilters,
  type SortOption,
  type FilterType,
  type FilterScope,
} from "@/components/expense-filters";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Wallet, ScanLine } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { errorText } from "@/lib/action-result";

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
  const t = useT();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<ExpenseWithSplits | null>(null);
  const [editingReceipt, setEditingReceipt] =
    useState<ExpenseWithSplits | null>(null);
  const [personalOpen, setPersonalOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanSeed, setScanSeed] = useState<ScanResult | null>(null);
  const [sort, setSort] = useState<SortOption>("date-desc");
  // Default to only the current user's expenses (paid by or splitting them).
  const [scope, setScope] = useState<FilterScope>("mine");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterPayer, setFilterPayer] = useState("all");

  function clearFilters() {
    setScope("mine");
    setFilterType("all");
    setFilterPayer("all");
  }

  // Open the prefilled form only after the scanner dialog has fully closed.
  // Two modal dialogs open at once corrupt Radix's shared pointer-events lock:
  // the form captures the scanner's `pointer-events: none` as the body's
  // "original" value and restores that on close, leaving the page dead.
  function onScanApplied(result: ScanResult) {
    window.setTimeout(() => setScanSeed(result), 200);
  }

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

  // Removed members keep appearing in expenses: strike through the name and
  // drop the accent color so they read as inactive.
  const names = Object.fromEntries(members.map((m) => [m.id, m.name]));
  const colors = Object.fromEntries(
    members.map((m) => [m.id, m.removed ? null : m.color]),
  );
  const removed = Object.fromEntries(members.map((m) => [m.id, m.removed]));

  // Only offer payers who actually appear in the list, so the filter never
  // shows a dead option.
  const payers = useMemo(() => {
    const ids = new Set(optimistic.map((e) => e.paidBy));
    return members.filter((m) => ids.has(m.id));
  }, [optimistic, members]);

  const visibleExpenses = useMemo(() => {
    let list = optimistic;
    // Default scope: every shared expense, but only the current user's own
    // (personal) expenses - other people's personal expenses are hidden.
    if (scope === "mine")
      list = list.filter((e) => !e.personal || e.paidBy === currentUserId);
    if (filterType === "shared") list = list.filter((e) => !e.personal);
    else if (filterType === "personal") list = list.filter((e) => e.personal);
    if (filterPayer !== "all")
      list = list.filter((e) => e.paidBy === filterPayer);

    // baseAmount lets amount sorting compare across currencies; the date sort
    // falls back to createdAt so same-day expenses keep a stable order.
    return [...list].sort((a, b) => {
      switch (sort) {
        case "date-asc":
          return (
            a.date.localeCompare(b.date) ||
            a.createdAt.getTime() - b.createdAt.getTime()
          );
        case "date-desc":
          return (
            b.date.localeCompare(a.date) ||
            b.createdAt.getTime() - a.createdAt.getTime()
          );
        case "amount-asc":
          return a.baseAmount - b.baseAmount;
        case "amount-desc":
          return b.baseAmount - a.baseAmount;
      }
    });
  }, [optimistic, sort, scope, filterType, filterPayer, currentUserId]);

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
      personal: input.personal ?? false,
      receipt: input.receipt ?? null,
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
          toast.success(t.expensesView.added);
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
            // A manual edit omits `receipt`; keep the existing breakdown so the
            // receipt marker doesn't flicker off before the refresh lands.
            receipt: input.receipt ?? target.receipt,
          },
        });
        const res = await updateExpense(target.id, input);
        if (res.ok) {
          toast.success(t.expensesView.updated);
          setEditing(null);
          router.refresh();
          resolve({ ok: true });
        } else {
          resolve({ ok: false, error: res.error });
        }
      });
    });
  }

  // Reopening the receipt editor edits items/tax/tip only; description, payer,
  // date and fx rate stay as they were and the split becomes exact again.
  function applyReceiptEdit(target: ExpenseWithSplits, result: ScanResult) {
    const input: CreateExpenseInput = {
      groupId,
      description: target.description,
      category: target.category ?? "",
      amount: result.totalMajor,
      currency: result.currency,
      paidBy: target.paidBy,
      date: target.date,
      splitType: "exact",
      fxRate: Number(target.fxRate) || 1,
      splits: result.splits.map((s) => ({
        userId: s.userId,
        value: s.valueMajor,
      })),
      personal: false,
      receipt: result.receipt,
    };
    submitEdit(target, input);
  }

  function onDelete(id: string) {
    startTransition(async () => {
      applyOptimistic({ type: "delete", id });
      const res = await deleteExpense(id, groupId);
      if (res.ok) {
        toast.success(t.expensesView.deleted);
        router.refresh();
      } else {
        toast.error(errorText(t, res.error));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* One wrap-aware toolbar. Mobile: row 1 = scan + own (50/50), row 2 =
          the primary "add" (majority) + sort/filter (compact). Desktop: a
          single row with the add actions left and sort/filter pushed right. */}
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <div className="order-2 flex-1 sm:order-1 sm:flex-none">
          <ExpenseForm
            groupId={groupId}
            baseCurrency={baseCurrency}
            members={members}
            currentUserId={currentUserId}
            onSubmitExpense={submitExpense}
          />
        </div>
        <Button
          variant="outline"
          className="order-1 min-w-0 flex-1 basis-[calc(50%-0.25rem)] sm:order-2 sm:flex-none sm:basis-auto"
          onClick={() => setScanOpen(true)}
        >
          <ScanLine className="size-4 shrink-0" />
          <span className="truncate">{t.receipt.scanReceipt}</span>
        </Button>
        <Button
          variant="outline"
          className="order-1 min-w-0 flex-1 basis-[calc(50%-0.25rem)] sm:order-3 sm:flex-none sm:basis-auto"
          onClick={() => setPersonalOpen(true)}
        >
          <Wallet className="size-4 shrink-0" />
          <span className="truncate">{t.expensesView.addPersonal}</span>
        </Button>
        {optimistic.length > 0 && (
          <div className="order-3 sm:order-4 sm:ml-auto">
            <ExpenseFilters
              scope={scope}
              onScopeChange={setScope}
              sort={sort}
              onSortChange={setSort}
              filterType={filterType}
              onFilterTypeChange={setFilterType}
              filterPayer={filterPayer}
              onFilterPayerChange={setFilterPayer}
              payers={payers}
              currentUserId={currentUserId}
            />
          </div>
        )}
      </div>
      <ReceiptScanner
        currency={baseCurrency}
        members={members}
        currentUserId={currentUserId}
        open={scanOpen}
        onOpenChange={setScanOpen}
        onApply={onScanApplied}
      />
      {personalOpen && (
        <ExpenseForm
          groupId={groupId}
          baseCurrency={baseCurrency}
          members={members}
          currentUserId={currentUserId}
          initialPersonal
          open
          onOpenChange={setPersonalOpen}
          onSubmitExpense={submitExpense}
        />
      )}
      {scanSeed && (
        <ExpenseForm
          groupId={groupId}
          baseCurrency={baseCurrency}
          members={members}
          currentUserId={currentUserId}
          initialScan={scanSeed}
          open
          onOpenChange={(o) => {
            if (!o) setScanSeed(null);
          }}
          onSubmitExpense={submitExpense}
        />
      )}
      {optimistic.length > 0 && visibleExpenses.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <div>
            <p className="font-semibold">{t.expenseFilters.noMatches}</p>
            <p className="text-sm text-muted-foreground">
              {t.expenseFilters.noMatchesBody}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            {t.expenseFilters.clearFilters}
          </Button>
        </Card>
      ) : (
        <ExpenseList
          baseCurrency={baseCurrency}
          expenses={visibleExpenses}
          names={names}
          colors={colors}
          removed={removed}
          currentUserId={currentUserId}
          onDelete={onDelete}
          onEdit={setEditing}
          onEditReceipt={setEditingReceipt}
        />
      )}
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
      {editingReceipt?.receipt && (
        <ReceiptScanner
          key={editingReceipt.id}
          currency={editingReceipt.currency}
          members={members}
          currentUserId={currentUserId}
          initialReceipt={editingReceipt.receipt}
          open
          onOpenChange={(o) => {
            if (!o) setEditingReceipt(null);
          }}
          onApply={(result) => applyReceiptEdit(editingReceipt, result)}
        />
      )}
    </div>
  );
}

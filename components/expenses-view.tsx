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
import { ReceiptScanner, type ScanResult } from "@/components/receipt-scanner";
import { ExpenseList } from "@/components/expense-list";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
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
  const [scanSeed, setScanSeed] = useState<ScanResult | null>(null);

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
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row">
        <div className="col-span-2 sm:col-span-1">
          <ExpenseForm
            groupId={groupId}
            baseCurrency={baseCurrency}
            members={members}
            currentUserId={currentUserId}
            onSubmitExpense={submitExpense}
          />
        </div>
        <ReceiptScanner
          currency={baseCurrency}
          members={members}
          currentUserId={currentUserId}
          onApply={onScanApplied}
        />
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => setPersonalOpen(true)}
        >
          <Wallet className="size-4" />
          {t.expensesView.addPersonal}
        </Button>
      </div>
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
      <ExpenseList
        baseCurrency={baseCurrency}
        expenses={optimistic}
        names={names}
        colors={colors}
        removed={removed}
        currentUserId={currentUserId}
        onDelete={onDelete}
        onEdit={setEditing}
        onEditReceipt={setEditingReceipt}
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

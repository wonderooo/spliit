"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { getSuggestedRate } from "@/server/actions/fx";
import type { ExpenseWithSplits, MemberUser } from "@/lib/queries";
import type { SplitType } from "@/lib/db/schema";
import type { CreateExpenseInput } from "@/lib/validators";
import {
  toMinorUnits,
  toMajorUnits,
  formatMoney,
  convertMinorUnits,
  getCurrency,
  normalizeDecimalInput,
} from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CurrencyPicker } from "@/components/currency-picker";
import { FxRateField } from "@/components/fx-rate-field";
import { type ScanResult } from "@/components/receipt-scanner";
import { useT } from "@/components/i18n-provider";
import { errorText } from "@/lib/action-result";
import { format } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";

function splitLabels(t: Dictionary): Record<SplitType, string> {
  return {
    equal: t.expenseForm.splitEqually,
    exact: t.expenseForm.splitExact,
    percentage: t.expenseForm.splitPercent,
    shares: t.expenseForm.splitShares,
  };
}

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function ExpenseForm({
  groupId,
  baseCurrency,
  members,
  currentUserId,
  onSubmitExpense,
  expense,
  initialScan,
  initialPersonal,
  open: controlledOpen,
  onOpenChange,
}: {
  groupId: string;
  baseCurrency: string;
  members: MemberUser[];
  currentUserId: string;
  onSubmitExpense: (
    input: CreateExpenseInput,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** When provided, the form edits this expense instead of creating one. */
  expense?: ExpenseWithSplits;
  /** Pre-fills a new expense from a scanned receipt (create mode only). */
  initialScan?: ScanResult;
  /** Creates a personal expense (just for the payer); no split editor. */
  initialPersonal?: boolean;
  /** Controlled open state (used for edit; create mode manages its own). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useT();
  const SPLIT_LABELS = splitLabels(t);
  const isEdit = expense != null;
  const isControlled = controlledOpen !== undefined;
  // A personal expense skips the split editor: it's spent only on the payer.
  const personal = isEdit ? (expense?.personal ?? false) : (initialPersonal ?? false);

  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen! : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;
  const [saving, setSaving] = useState(false);
  const descRef = useRef<HTMLInputElement>(null);

  // A scanned receipt seeds a brand-new expense; it never applies when editing.
  const scan = expense ? undefined : initialScan;

  const [description, setDescription] = useState(
    expense?.description ??
      (scan ? scan.merchant?.trim() || t.expenseForm.defaultDescription : ""),
  );
  const [amount, setAmount] = useState(
    expense
      ? String(toMajorUnits(expense.amount, expense.currency))
      : scan
        ? String(scan.totalMajor)
        : "",
  );
  const [currency, setCurrency] = useState(
    expense?.currency ?? scan?.currency ?? baseCurrency,
  );
  const [paidBy, setPaidBy] = useState(expense?.paidBy ?? currentUserId);
  const [date, setDate] = useState(expense?.date ?? todayISO());
  const [splitType, setSplitType] = useState<SplitType>(
    (expense?.splitType as SplitType) ?? (scan ? "exact" : "equal"),
  );
  const [selected, setSelected] = useState<Set<string>>(
    expense
      ? new Set(expense.splits.map((s) => s.userId))
      : scan
        ? new Set(scan.splits.map((s) => s.userId))
        : new Set(members.filter((m) => !m.removed).map((m) => m.id)),
  );
  const [values, setValues] = useState<Record<string, string>>(
    expense
      ? initialEditValues(expense)
      : scan
        ? Object.fromEntries(
            scan.splits.map((s) => [s.userId, String(s.valueMajor)]),
          )
        : {},
  );
  const [fxRate, setFxRate] = useState(expense?.fxRate ?? "1");

  const isForeign = currency !== baseCurrency;
  const amountNum = Number(amount) || 0;
  const totalMinor = amount ? safeMinor(amount, currency) : 0;

  // Skip the first auto-FX fetch when editing so we keep the saved rate; later
  // currency/date edits still refresh it.
  const skipFxFetch = useRef(isEdit);

  // Fetch a suggested FX rate when currency/date changes.
  useEffect(() => {
    if (!isForeign) {
      setFxRate("1");
      return;
    }
    if (skipFxFetch.current) {
      skipFxFetch.current = false;
      return;
    }
    let active = true;
    getSuggestedRate(date, currency, baseCurrency).then((rate) => {
      if (active && rate != null) setFxRate(String(rate));
    });
    return () => {
      active = false;
    };
  }, [currency, baseCurrency, date, isForeign]);

  // Show every member so removed people can still be picked (e.g. a payer or
  // participant in a back-dated expense, or one already on the expense being
  // edited). Removed members sort last and stay unchecked by default.
  const formMembers = useMemo(
    () => [...members].sort((a, b) => Number(a.removed) - Number(b.removed)),
    [members],
  );

  const participants = members.filter((m) => selected.has(m.id));

  // Live validation of the split.
  const splitState = useMemo(
    () => validateSplit(t, splitType, participants, values, totalMinor, currency),
    [t, splitType, participants, values, totalMinor, currency],
  );

  const baseAmount = isForeign
    ? convertMinorUnits(totalMinor, Number(fxRate) || 0, currency, baseCurrency)
    : totalMinor;

  function toggleMember(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reset() {
    setDescription("");
    setAmount("");
    setCurrency(baseCurrency);
    setPaidBy(currentUserId);
    setDate(todayISO());
    setSplitType("equal");
    setSelected(new Set(members.filter((m) => !m.removed).map((m) => m.id)));
    setValues({});
    setFxRate("1");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!personal && !splitState.valid) {
      toast.error(splitState.message);
      return;
    }

    // A personal expense always belongs to the current user; no payer picker.
    const payer = personal ? currentUserId : paidBy;

    // A personal expense is split entirely back to its payer (nets to zero).
    const splits = personal
      ? [{ userId: payer }]
      : participants.map((m) => {
          if (splitType === "equal") return { userId: m.id };
          const raw = Number(values[m.id]) || 0;
          return { userId: m.id, value: raw };
        });

    const input: CreateExpenseInput = {
      groupId,
      description,
      category: "",
      amount: amountNum,
      currency,
      paidBy: payer,
      date,
      splitType: personal ? "equal" : splitType,
      fxRate: Number(fxRate) || 1,
      splits,
      personal,
      // Carry the scanned breakdown so a new receipt expense is reopenable.
      ...(scan ? { receipt: scan.receipt } : {}),
    };

    // Close instantly — the parent shows the expense optimistically.
    setSaving(true);
    setOpen(false);
    const res = await onSubmitExpense(input);
    setSaving(false);

    if (res.ok) {
      if (!isEdit) reset();
    } else {
      toast.error(
        res.error
          ? errorText(t, res.error)
          : isEdit
            ? t.expenseForm.couldNotSaveChanges
            : t.expenseForm.couldNotAddExpense,
      );
      setOpen(true); // reopen so the user can fix and retry (values preserved)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button className="w-full sm:w-auto">
            <Plus className="size-4" />
            {t.expenseForm.addExpense}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent
        className="max-h-[92svh] gap-4 overflow-y-auto sm:max-w-lg"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          descRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {personal
              ? isEdit
                ? t.expenseForm.editPersonal
                : t.expenseForm.addPersonal
              : isEdit
                ? t.expenseForm.editExpense
                : t.expenseForm.addExpense}
          </DialogTitle>
          <DialogDescription>
            {personal
              ? t.expenseForm.personalDescription
              : t.expenseForm.description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="desc">{t.expenseForm.descriptionLabel}</Label>
            <Input
              id="desc"
              ref={descRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.expenseForm.descriptionPlaceholder}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 flex flex-col gap-2">
              <Label htmlFor="amount">{t.expenseForm.amount}</Label>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) =>
                  setAmount(normalizeDecimalInput(e.target.value))
                }
                placeholder="0.00"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t.expenseForm.currency}</Label>
              <CurrencyPicker value={currency} onChange={setCurrency} />
            </div>
          </div>

          {isForeign && (
            <FxRateField
              id="fx"
              currency={currency}
              baseCurrency={baseCurrency}
              value={fxRate}
              onChange={setFxRate}
              baseAmount={baseAmount}
              label={format(t.expenseForm.rateLabel, { currency, baseCurrency })}
            />
          )}

          <div
            className={cn(
              "grid gap-3",
              personal ? "grid-cols-1" : "grid-cols-2",
            )}
          >
            {!personal && (
              <div className="flex flex-col gap-2">
                <Label>{t.expenseForm.paidBy}</Label>
                <Select value={paidBy} onValueChange={setPaidBy}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className={m.removed ? "line-through" : undefined}>
                          {m.id === currentUserId ? t.common.you : m.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="date">{t.expenseForm.date}</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          {personal && (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              {t.expenseForm.personalHint}
            </p>
          )}

          {/* Split type selector */}
          {!personal && (
          <>
          <div className="flex flex-col gap-2">
            <Label>{t.expenseForm.split}</Label>
            <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
              {(Object.keys(SPLIT_LABELS) as SplitType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSplitType(t)}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                    splitType === t
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {SPLIT_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Participants / split editor */}
          <div className="flex flex-col gap-1.5">
            {formMembers.map((m) => {
              const isSel = selected.has(m.id);
              const share = splitState.shares[m.id];
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-2.5",
                    !isSel && "opacity-50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggleMember(m.id)}
                    className="size-4 accent-primary"
                    aria-label={format(t.expenseForm.includeMember, {
                      name: m.name,
                    })}
                  />
                  <span
                    className={cn(
                      "flex-1 truncate text-sm",
                      m.removed && "line-through",
                    )}
                  >
                    {m.id === currentUserId ? t.common.you : m.name}
                  </span>

                  {isSel && splitType === "equal" && (
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {share != null ? formatMoney(share, currency) : "-"}
                    </span>
                  )}

                  {isSel && splitType !== "equal" && (
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={values[m.id] ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({
                            ...v,
                            [m.id]: normalizeDecimalInput(e.target.value),
                          }))
                        }
                        className="h-8 w-24 text-right"
                      />
                      <span className="min-w-8 text-xs text-muted-foreground">
                        {splitType === "percentage"
                          ? "%"
                          : splitType === "shares"
                            ? "×"
                            : getCurrency(currency).symbol}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Split status */}
          <p
            className={cn(
              "text-xs",
              splitState.valid ? "text-muted-foreground" : "text-rose-500",
            )}
          >
            {splitState.message}
          </p>
          </>
          )}

          <DialogFooter>
            <Button
              type="submit"
              disabled={saving || !description.trim() || amountNum <= 0}
            >
              {saving
                ? t.expenseForm.saving
                : isEdit
                  ? t.expenseForm.saveChanges
                  : personal
                    ? t.expenseForm.addPersonal
                    : t.expenseForm.addExpense}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Seed the split editor when editing: exact splits show major-unit amounts,
 *  percentage/shares show their stored raw weight. Equal needs no values. */
function initialEditValues(expense: ExpenseWithSplits): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of expense.splits) {
    if (expense.splitType === "exact") {
      out[s.userId] = String(toMajorUnits(s.amount, expense.currency));
    } else if (
      expense.splitType === "percentage" ||
      expense.splitType === "shares"
    ) {
      out[s.userId] = s.shareValue != null ? String(Number(s.shareValue)) : "";
    }
  }
  return out;
}

function safeMinor(amount: string, currency: string) {
  try {
    return toMinorUnits(amount, currency);
  } catch {
    return 0;
  }
}

type SplitState = {
  valid: boolean;
  message: string;
  shares: Record<string, number>;
};

function validateSplit(
  t: Dictionary,
  splitType: SplitType,
  participants: MemberUser[],
  values: Record<string, string>,
  totalMinor: number,
  currency: string,
): SplitState {
  if (participants.length === 0) {
    return { valid: false, message: t.expenseForm.pickAtLeastOnePerson, shares: {} };
  }
  if (totalMinor <= 0) {
    return { valid: false, message: t.expenseForm.enterAnAmount, shares: {} };
  }

  if (splitType === "equal") {
    const per = Math.floor(totalMinor / participants.length);
    const shares: Record<string, number> = {};
    participants.forEach((m, i) => {
      shares[m.id] = per + (i < totalMinor - per * participants.length ? 1 : 0);
    });
    return {
      valid: true,
      message: format(t.expenseForm.splitEquallyEach, {
        amount: formatMoney(per, currency),
      }),
      shares,
    };
  }

  if (splitType === "exact") {
    let sum = 0;
    const shares: Record<string, number> = {};
    for (const m of participants) {
      const minor = safeMinor(values[m.id] ?? "0", currency);
      shares[m.id] = minor;
      sum += minor;
    }
    const diff = totalMinor - sum;
    return {
      valid: diff === 0,
      message:
        diff === 0
          ? t.expenseForm.amountsAddUp
          : format(
              diff > 0 ? t.expenseForm.missingAmount : t.expenseForm.overByAmount,
              { amount: formatMoney(Math.abs(diff), currency) },
            ),
      shares,
    };
  }

  if (splitType === "percentage") {
    let sum = 0;
    for (const m of participants) sum += Number(values[m.id]) || 0;
    return {
      valid: Math.abs(sum - 100) < 1e-6,
      message:
        Math.abs(sum - 100) < 1e-6
          ? t.expenseForm.percentagesAddUp
          : format(t.expenseForm.percentagesAddUpTo, { sum }),
      shares: {},
    };
  }

  // shares
  let sum = 0;
  for (const m of participants) sum += Number(values[m.id]) || 0;
  return {
    valid: sum > 0,
    message:
      sum > 0
        ? t.expenseForm.splitByShares
        : t.expenseForm.enterShareForOne,
    shares: {},
  };
}

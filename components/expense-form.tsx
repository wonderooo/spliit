"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createExpense } from "@/server/actions/expenses";
import { getSuggestedRate } from "@/server/actions/fx";
import type { MemberUser } from "@/lib/queries";
import type { SplitType } from "@/lib/db/schema";
import { toMinorUnits, formatMoney, convertMinorUnits } from "@/lib/currency";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CurrencyPicker } from "@/components/currency-picker";
import { cn } from "@/lib/utils";

const SPLIT_LABELS: Record<SplitType, string> = {
  equal: "Equally",
  exact: "Exact",
  percentage: "Percent",
  shares: "Shares",
};

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
}: {
  groupId: string;
  baseCurrency: string;
  members: MemberUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(baseCurrency);
  const [paidBy, setPaidBy] = useState(currentUserId);
  const [date, setDate] = useState(todayISO());
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(members.map((m) => m.id)),
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [fxRate, setFxRate] = useState("1");

  const isForeign = currency !== baseCurrency;
  const amountNum = Number(amount) || 0;
  const totalMinor = amount ? safeMinor(amount, currency) : 0;

  // Fetch a suggested FX rate when currency/date changes.
  useEffect(() => {
    if (!isForeign) {
      setFxRate("1");
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

  const participants = members.filter((m) => selected.has(m.id));

  // Live validation of the split.
  const splitState = useMemo(
    () => validateSplit(splitType, participants, values, totalMinor, currency),
    [splitType, participants, values, totalMinor, currency],
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
    setSelected(new Set(members.map((m) => m.id)));
    setValues({});
    setFxRate("1");
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!splitState.valid) {
      toast.error(splitState.message);
      return;
    }

    const splits = participants.map((m) => {
      if (splitType === "equal") return { userId: m.id };
      const raw = Number(values[m.id]) || 0;
      return { userId: m.id, value: raw };
    });

    startTransition(async () => {
      const res = await createExpense({
        groupId,
        description,
        amount: amountNum,
        currency,
        paidBy,
        date,
        splitType,
        fxRate: Number(fxRate) || 1,
        splits,
      });
      if (res.ok) {
        toast.success("Expense added");
        setOpen(false);
        reset();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="w-full sm:w-auto">
          <Plus className="size-4" />
          Add expense
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[92svh] overflow-y-auto rounded-t-2xl sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>Add expense</SheetTitle>
          <SheetDescription>
            Record what was paid and how to split it.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 overflow-y-auto px-4 pb-2"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="desc">Description</Label>
            <Input
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Dinner, taxi, groceries…"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 flex flex-col gap-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Currency</Label>
              <CurrencyPicker value={currency} onChange={setCurrency} />
            </div>
          </div>

          {isForeign && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-end gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="fx" className="text-xs">
                    Rate (1 {currency} → {baseCurrency})
                  </Label>
                  <Input
                    id="fx"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={fxRate}
                    onChange={(e) => setFxRate(e.target.value)}
                  />
                </div>
                <p className="pb-2 text-sm text-muted-foreground">
                  ={" "}
                  <span className="font-medium text-foreground">
                    {formatMoney(baseAmount, baseCurrency)}
                  </span>
                </p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Auto-filled from daily rates — edit if you used a different one.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Paid by</Label>
              <Select value={paidBy} onValueChange={setPaidBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.id === currentUserId ? "You" : m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Split type selector */}
          <div className="flex flex-col gap-2">
            <Label>Split</Label>
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
            {members.map((m) => {
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
                    aria-label={`Include ${m.name}`}
                  />
                  <span className="flex-1 truncate text-sm">
                    {m.id === currentUserId ? "You" : m.name}
                  </span>

                  {isSel && splitType === "equal" && (
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {share != null ? formatMoney(share, currency) : "—"}
                    </span>
                  )}

                  {isSel && splitType !== "equal" && (
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        value={values[m.id] ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [m.id]: e.target.value }))
                        }
                        className="h-8 w-24 text-right"
                        placeholder={
                          splitType === "percentage"
                            ? "%"
                            : splitType === "shares"
                              ? "shares"
                              : "amount"
                        }
                      />
                      {splitType === "percentage" && (
                        <span className="w-3 text-xs text-muted-foreground">
                          %
                        </span>
                      )}
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

          <SheetFooter className="px-0">
            <Button
              type="submit"
              disabled={pending || !description.trim() || amountNum <= 0}
            >
              {pending ? "Saving…" : "Add expense"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
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
  splitType: SplitType,
  participants: MemberUser[],
  values: Record<string, string>,
  totalMinor: number,
  currency: string,
): SplitState {
  if (participants.length === 0) {
    return { valid: false, message: "Pick at least one person.", shares: {} };
  }
  if (totalMinor <= 0) {
    return { valid: false, message: "Enter an amount.", shares: {} };
  }

  if (splitType === "equal") {
    const per = Math.floor(totalMinor / participants.length);
    const shares: Record<string, number> = {};
    participants.forEach((m, i) => {
      shares[m.id] = per + (i < totalMinor - per * participants.length ? 1 : 0);
    });
    return {
      valid: true,
      message: `Split equally — ${formatMoney(per, currency)} each.`,
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
          ? "Amounts add up."
          : `${diff > 0 ? "Missing" : "Over by"} ${formatMoney(
              Math.abs(diff),
              currency,
            )}.`,
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
          ? "Percentages add up to 100%."
          : `Percentages add up to ${sum}% (need 100%).`,
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
        ? "Split by shares."
        : "Enter a share for at least one person.",
    shares: {},
  };
}

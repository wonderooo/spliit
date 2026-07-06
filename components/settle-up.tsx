"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Plus, Trash2, PartyPopper, History } from "lucide-react";
import { recordSettlement, deleteSettlement } from "@/server/actions/settlements";
import { getSuggestedRate } from "@/server/actions/fx";
import type { MemberUser } from "@/lib/queries";
import type { Transaction } from "@/lib/balances";
import {
  formatMoney,
  toMajorUnits,
  convertMinorUnits,
  toMinorUnits,
  normalizeDecimalInput,
} from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import { CurrencyPicker } from "@/components/currency-picker";
import { FxRateField } from "@/components/fx-rate-field";
import { useT } from "@/components/i18n-provider";
import { errorText } from "@/lib/action-result";
import { format } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { memberColorStyle } from "@/lib/member-colors";

type SettlementRow = {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  baseAmount: number;
  date: string;
  note: string | null;
  createdBy: string;
};

type Prefill = {
  fromUserId: string;
  toUserId: string;
  amountMajor: number;
};

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

type RecordPayload = {
  fromUserId: string;
  toUserId: string;
  amountMajor: number;
  currency: string;
  fxRate: number;
  date: string;
  note: string;
};

let tempSeq = 0;

export function SettleUp({
  groupId,
  baseCurrency,
  members,
  currentUserId,
  transactions,
  settlements,
}: {
  groupId: string;
  baseCurrency: string;
  members: MemberUser[];
  currentUserId: string;
  transactions: Transaction[];
  settlements: SettlementRow[];
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [suggestedMine, setSuggestedMine] = useState(true);
  const [historyMine, setHistoryMine] = useState(false);
  const [toDelete, setToDelete] = useState<SettlementRow | null>(null);
  const [, startTransition] = useTransition();

  const [optimistic, applyOptimistic] = useOptimistic(
    settlements,
    (
      state,
      action:
        | { type: "add"; settlement: SettlementRow }
        | { type: "delete"; id: string },
    ) =>
      action.type === "add"
        ? [action.settlement, ...state]
        : state.filter((s) => s.id !== action.id),
  );

  // Suggested payments come from the server, so without an optimistic layer a
  // just-settled row lingers until router.refresh() lands. Subtract the paid
  // base amount from the matching from→to suggestion (drop it once cleared).
  const [optimisticTx, applyTxOptimistic] = useOptimistic(
    transactions,
    (state, paid: { from: string; to: string; baseAmount: number }) => {
      let remaining = paid.baseAmount;
      const out: Transaction[] = [];
      for (const tx of state) {
        if (remaining > 0 && tx.from === paid.from && tx.to === paid.to) {
          if (tx.amount > remaining) {
            out.push({ ...tx, amount: tx.amount - remaining });
            remaining = 0;
          } else {
            remaining -= tx.amount;
          }
        } else {
          out.push(tx);
        }
      }
      return out;
    },
  );

  const nameOf = (uid: string) => {
    if (uid === currentUserId) return t.common.you;
    const m = members.find((m) => m.id === uid);
    if (!m) return t.settleUp.someone;
    return m.name;
  };
  // Removed members render without their accent color (neutral text).
  const colorOf = (uid: string) => {
    const m = members.find((m) => m.id === uid);
    return m && !m.removed ? m.color : null;
  };
  // Removed members read as inactive via a strikethrough on their name.
  const removedOf = (uid: string) =>
    members.find((m) => m.id === uid)?.removed ?? false;

  // Each list has its own "just me" filter. Only worth offering with 3+
  // members, since with two everyone is always involved in every payment.
  const canFilter = members.length > 2;
  const visibleTransactions =
    canFilter && suggestedMine
      ? optimisticTx.filter(
          (tx) => tx.from === currentUserId || tx.to === currentUserId,
        )
      : optimisticTx;
  const visibleHistory =
    canFilter && historyMine
      ? optimistic.filter(
          (s) => s.fromUserId === currentUserId || s.toUserId === currentUserId,
        )
      : optimistic;

  function openWith(p: Prefill | null) {
    setPrefill(p);
    setOpen(true);
  }

  function recordPayment(p: RecordPayload) {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      startTransition(async () => {
        let amountMinor = 0;
        try {
          amountMinor = toMinorUnits(String(p.amountMajor), p.currency);
        } catch {
          amountMinor = 0;
        }
        const baseAmount = convertMinorUnits(
          amountMinor,
          p.fxRate,
          p.currency,
          baseCurrency,
        );
        applyOptimistic({
          type: "add",
          settlement: {
            id: `optimistic-${tempSeq++}`,
            fromUserId: p.fromUserId,
            toUserId: p.toUserId,
            amount: amountMinor,
            currency: p.currency,
            baseAmount,
            date: p.date,
            note: p.note || null,
            createdBy: currentUserId,
          },
        });
        applyTxOptimistic({
          from: p.fromUserId,
          to: p.toUserId,
          baseAmount,
        });
        const res = await recordSettlement({
          groupId,
          fromUserId: p.fromUserId,
          toUserId: p.toUserId,
          amount: p.amountMajor,
          currency: p.currency,
          fxRate: p.fxRate,
          date: p.date,
          note: p.note,
        });
        if (res.ok) {
          toast.success(t.settleUp.paymentRecorded);
          router.refresh();
          resolve({ ok: true });
        } else {
          resolve({ ok: false, error: res.error });
        }
      });
    });
  }

  function deletePayment(id: string) {
    startTransition(async () => {
      applyOptimistic({ type: "delete", id });
      const res = await deleteSettlement(id, groupId);
      if (res.ok) {
        toast.success(t.settleUp.paymentRemoved);
        router.refresh();
      } else {
        toast.error(errorText(t, res.error));
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Suggested payments */}
      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t.settleUp.suggestedPayments}
          </h2>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              aria-label={t.settleUp.recordPayment}
              onClick={() =>
                openWith({
                  fromUserId: currentUserId,
                  toUserId:
                    members.find((m) => m.id !== currentUserId)?.id ??
                    currentUserId,
                  amountMajor: 0,
                })
              }
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">
                {t.settleUp.recordPayment}
              </span>
            </Button>
            {canFilter && (
              <ScopeToggle mine={suggestedMine} onChange={setSuggestedMine} />
            )}
          </div>
        </div>

        {transactions.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-8 text-center">
            <PartyPopper className="size-6 text-emerald-500" />
            <p className="font-semibold">{t.settleUp.allSettledUp}</p>
            <p className="text-sm text-muted-foreground">
              {t.settleUp.nothingToPay}
            </p>
          </Card>
        ) : visibleTransactions.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">
            {t.settleUp.noneInvolvingYou}
          </Card>
        ) : (
          <Card className="gap-0 p-0">
            <ul className="divide-y">
              {visibleTransactions.map((tx, i) => (
                <li key={i} className="flex items-center gap-2 px-4 py-3">
                  <div className="flex flex-1 items-center gap-2 text-sm">
                    <span
                      className={cn(
                        "font-medium",
                        removedOf(tx.from) && "line-through",
                      )}
                      style={memberColorStyle(colorOf(tx.from))}
                    >
                      {nameOf(tx.from)}
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground" />
                    <span
                      className={cn(
                        "font-medium",
                        removedOf(tx.to) && "line-through",
                      )}
                      style={memberColorStyle(colorOf(tx.to))}
                    >
                      {nameOf(tx.to)}
                    </span>
                  </div>
                  <span className="font-semibold tabular-nums">
                    {formatMoney(tx.amount, baseCurrency)}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      openWith({
                        fromUserId: tx.from,
                        toUserId: tx.to,
                        amountMajor: toMajorUnits(tx.amount, baseCurrency),
                      })
                    }
                  >
                    {t.settleUp.settle}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* Payment history */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t.settleUp.paymentHistory}
          </h2>
          {canFilter && optimistic.length > 0 && (
            <ScopeToggle mine={historyMine} onChange={setHistoryMine} />
          )}
        </div>
        {optimistic.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-8 text-center">
            <History className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {t.settleUp.noPaymentsYet}
            </p>
          </Card>
        ) : visibleHistory.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">
            {t.settleUp.noneInvolvingYou}
          </Card>
        ) : (
          <Card className="gap-0 p-0">
            <ul className="divide-y">
              {visibleHistory.map((s) => (
                <SettlementItem
                  key={s.id}
                  settlement={s}
                  baseCurrency={baseCurrency}
                  currentUserId={currentUserId}
                  nameOf={nameOf}
                  colorOf={colorOf}
                  removedOf={removedOf}
                  onDelete={setToDelete}
                />
              ))}
            </ul>
          </Card>
        )}
      </section>

      <SettleDialog
        open={open}
        onOpenChange={setOpen}
        prefill={prefill}
        baseCurrency={baseCurrency}
        members={members}
        currentUserId={currentUserId}
        onRecord={recordPayment}
      />

      <Dialog
        open={toDelete != null}
        onOpenChange={(o) => {
          if (!o) setToDelete(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.settleUp.deleteTitle}</DialogTitle>
            <DialogDescription>
              {toDelete
                ? format(t.settleUp.deleteBody, {
                    from: nameOf(toDelete.fromUserId),
                    to: nameOf(toDelete.toUserId),
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
                if (toDelete) deletePayment(toDelete.id);
                setToDelete(null);
              }}
            >
              {t.settleUp.deletePayment}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScopeToggle({
  mine,
  onChange,
}: {
  mine: boolean;
  onChange: (mine: boolean) => void;
}) {
  const t = useT();
  return (
    <div className="inline-flex gap-0.5 rounded-md bg-muted p-0.5">
      {[
        { value: true, label: t.settleUp.filterMine },
        { value: false, label: t.settleUp.filterEveryone },
      ].map((opt) => (
        <button
          key={opt.label}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded px-2 py-0.5 text-xs font-medium transition-colors",
            mine === opt.value
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SettlementItem({
  settlement: s,
  baseCurrency,
  currentUserId,
  nameOf,
  colorOf,
  removedOf,
  onDelete,
}: {
  settlement: SettlementRow;
  baseCurrency: string;
  currentUserId: string;
  nameOf: (uid: string) => string;
  colorOf: (uid: string) => string | null;
  removedOf: (uid: string) => boolean;
  onDelete: (settlement: SettlementRow) => void;
}) {
  const t = useT();
  const foreign = s.currency !== baseCurrency;
  // Recorder only when someone other than the payer logged the payment;
  // otherwise the from → to line already says it.
  const recordedBy =
    s.createdBy !== s.fromUserId
      ? s.createdBy === currentUserId
        ? t.settleUp.recordedByYou
        : format(t.settleUp.recordedBy, { name: nameOf(s.createdBy) })
      : null;

  return (
    <li className="flex items-center gap-2 px-4 py-3">
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-2 text-sm">
          <span
            className={cn(
              "font-medium",
              removedOf(s.fromUserId) && "line-through",
            )}
            style={memberColorStyle(colorOf(s.fromUserId))}
          >
            {nameOf(s.fromUserId)}
          </span>
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <span
            className={cn(
              "font-medium",
              removedOf(s.toUserId) && "line-through",
            )}
            style={memberColorStyle(colorOf(s.toUserId))}
          >
            {nameOf(s.toUserId)}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {s.date}
          {s.note ? ` · ${s.note}` : ""}
          {recordedBy ? ` · ${recordedBy}` : ""}
        </span>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold tabular-nums">
          {formatMoney(s.amount, s.currency)}
        </p>
        {foreign ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatMoney(s.baseAmount, baseCurrency)}
          </p>
        ) : null}
      </div>
      <button
        onClick={() => onDelete(s)}
        className="rounded-md p-1 text-muted-foreground hover:text-rose-500"
        aria-label={t.settleUp.deletePayment}
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}

function SettleDialog({
  open,
  onOpenChange,
  prefill,
  baseCurrency,
  members,
  currentUserId,
  onRecord,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefill: Prefill | null;
  baseCurrency: string;
  members: MemberUser[];
  currentUserId: string;
  onRecord: (p: RecordPayload) => Promise<{ ok: boolean; error?: string }>;
}) {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const [fromUserId, setFromUserId] = useState(currentUserId);
  const [toUserId, setToUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(baseCurrency);
  const [fxRate, setFxRate] = useState("1");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");

  // Apply prefill whenever the dialog opens.
  useEffect(() => {
    if (open && prefill) {
      setFromUserId(prefill.fromUserId);
      setToUserId(prefill.toUserId);
      setAmount(prefill.amountMajor ? String(prefill.amountMajor) : "");
      setCurrency(baseCurrency);
      setFxRate("1");
      setDate(todayISO());
      setNote("");
    }
  }, [open, prefill, baseCurrency]);

  const isForeign = currency !== baseCurrency;

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

  const amountNum = Number(amount) || 0;
  const baseAmount = (() => {
    if (!amount) return 0;
    try {
      const minor = toMinorUnits(amount, currency);
      return isForeign
        ? convertMinorUnits(minor, Number(fxRate) || 0, currency, baseCurrency)
        : minor;
    } catch {
      return 0;
    }
  })();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!toUserId) {
      toast.error(t.errors.pickRecipient);
      return;
    }
    if (fromUserId === toUserId) {
      toast.error(t.errors.settlementSamePerson);
      return;
    }

    // Close instantly — the payment shows in history optimistically.
    setSaving(true);
    onOpenChange(false);
    const res = await onRecord({
      fromUserId,
      toUserId,
      amountMajor: amountNum,
      currency,
      fxRate: Number(fxRate) || 1,
      date,
      note,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ? errorText(t, res.error) : t.settleUp.couldNotRecord);
      onOpenChange(true);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92svh] overflow-y-auto"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          amountRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t.settleUp.dialogTitle}</DialogTitle>
          <DialogDescription>{t.settleUp.dialogDescription}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>{t.settleUp.from}</Label>
              <Select value={fromUserId} onValueChange={setFromUserId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className={m.removed ? "line-through" : undefined}>
                        {m.id === currentUserId ? t.common.you : m.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t.settleUp.to}</Label>
              <Select value={toUserId} onValueChange={setToUserId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t.settleUp.selectPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className={m.removed ? "line-through" : undefined}>
                        {m.id === currentUserId ? t.common.you : m.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 flex flex-col gap-2">
              <Label htmlFor="s-amount">{t.settleUp.amount}</Label>
              <Input
                id="s-amount"
                ref={amountRef}
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(normalizeDecimalInput(e.target.value))}
                placeholder="0.00"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t.settleUp.currency}</Label>
              <CurrencyPicker value={currency} onChange={setCurrency} />
            </div>
          </div>

          {isForeign && (
            <FxRateField
              id="s-fx"
              currency={currency}
              baseCurrency={baseCurrency}
              value={fxRate}
              onChange={setFxRate}
              baseAmount={baseAmount}
              label={format(t.settleUp.rateLabel, { currency, baseCurrency })}
            />
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="s-date">{t.settleUp.date}</Label>
            <Input
              id="s-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="s-note">{t.settleUp.noteLabel}</Label>
            <Input
              id="s-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.settleUp.notePlaceholder}
            />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={saving || amountNum <= 0 || !toUserId}
            >
              {saving ? t.settleUp.saving : t.settleUp.recordPayment}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

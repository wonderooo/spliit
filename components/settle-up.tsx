"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Plus, Trash2, PartyPopper } from "lucide-react";
import { recordSettlement, deleteSettlement } from "@/server/actions/settlements";
import { getSuggestedRate } from "@/server/actions/fx";
import type { MemberUser } from "@/lib/queries";
import type { Transaction } from "@/lib/balances";
import {
  formatMoney,
  toMajorUnits,
  convertMinorUnits,
  toMinorUnits,
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
import { useT } from "@/components/i18n-provider";
import { errorText } from "@/lib/action-result";
import { format } from "@/lib/i18n/config";

type SettlementRow = {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  baseAmount: number;
  date: string;
  note: string | null;
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

  const nameOf = (uid: string) =>
    uid === currentUserId
      ? t.common.you
      : (members.find((m) => m.id === uid)?.name ?? t.settleUp.someone);

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
          },
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
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t.settleUp.suggestedPayments}
          </h2>
          <Button
            size="sm"
            variant="outline"
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
            {t.settleUp.recordPayment}
          </Button>
        </div>

        {transactions.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-8 text-center">
            <PartyPopper className="size-6 text-emerald-500" />
            <p className="font-semibold">{t.settleUp.allSettledUp}</p>
            <p className="text-sm text-muted-foreground">
              {t.settleUp.nothingToPay}
            </p>
          </Card>
        ) : (
          <Card className="gap-0 p-0">
            <ul className="divide-y">
              {transactions.map((tx, i) => (
                <li key={i} className="flex items-center gap-2 px-4 py-3">
                  <div className="flex flex-1 items-center gap-2 text-sm">
                    <span className="font-medium">{nameOf(tx.from)}</span>
                    <ArrowRight className="size-4 text-muted-foreground" />
                    <span className="font-medium">{nameOf(tx.to)}</span>
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
      {optimistic.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t.settleUp.paymentHistory}
          </h2>
          <Card className="gap-0 p-0">
            <ul className="divide-y">
              {optimistic.map((s) => (
                <SettlementItem
                  key={s.id}
                  settlement={s}
                  baseCurrency={baseCurrency}
                  nameOf={nameOf}
                  onDelete={deletePayment}
                />
              ))}
            </ul>
          </Card>
        </section>
      )}

      <SettleDialog
        open={open}
        onOpenChange={setOpen}
        prefill={prefill}
        baseCurrency={baseCurrency}
        members={members}
        currentUserId={currentUserId}
        onRecord={recordPayment}
      />
    </div>
  );
}

function SettlementItem({
  settlement: s,
  baseCurrency,
  nameOf,
  onDelete,
}: {
  settlement: SettlementRow;
  baseCurrency: string;
  nameOf: (uid: string) => string;
  onDelete: (id: string) => void;
}) {
  const t = useT();
  const foreign = s.currency !== baseCurrency;

  return (
    <li className="flex items-center gap-2 px-4 py-3">
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{nameOf(s.fromUserId)}</span>
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <span className="font-medium">{nameOf(s.toUserId)}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {s.date}
          {s.note ? ` · ${s.note}` : ""}
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
        onClick={() => onDelete(s.id)}
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
      <DialogContent className="max-h-[92svh] overflow-y-auto">
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
                      {m.id === currentUserId ? t.common.you : m.name}
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
                      {m.id === currentUserId ? t.common.you : m.name}
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
              <Label>{t.settleUp.currency}</Label>
              <CurrencyPicker value={currency} onChange={setCurrency} />
            </div>
          </div>

          {isForeign && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-end gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="s-fx" className="text-xs">
                    {format(t.settleUp.rateLabel, { currency, baseCurrency })}
                  </Label>
                  <Input
                    id="s-fx"
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
            </div>
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

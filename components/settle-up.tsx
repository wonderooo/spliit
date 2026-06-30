"use client";

import { useEffect, useState, useTransition } from "react";
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<Prefill | null>(null);

  const nameOf = (uid: string) =>
    uid === currentUserId
      ? "You"
      : (members.find((m) => m.id === uid)?.name ?? "Someone");

  function openWith(p: Prefill | null) {
    setPrefill(p);
    setOpen(true);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Suggested payments */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Suggested payments
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
            Record payment
          </Button>
        </div>

        {transactions.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-8 text-center">
            <PartyPopper className="size-6 text-emerald-500" />
            <p className="font-semibold">All settled up</p>
            <p className="text-sm text-muted-foreground">
              Nothing to pay back right now.
            </p>
          </Card>
        ) : (
          <Card className="gap-0 p-0">
            <ul className="divide-y">
              {transactions.map((t, i) => (
                <li key={i} className="flex items-center gap-2 px-4 py-3">
                  <div className="flex flex-1 items-center gap-2 text-sm">
                    <span className="font-medium">{nameOf(t.from)}</span>
                    <ArrowRight className="size-4 text-muted-foreground" />
                    <span className="font-medium">{nameOf(t.to)}</span>
                  </div>
                  <span className="font-semibold tabular-nums">
                    {formatMoney(t.amount, baseCurrency)}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      openWith({
                        fromUserId: t.from,
                        toUserId: t.to,
                        amountMajor: toMajorUnits(t.amount, baseCurrency),
                      })
                    }
                  >
                    Settle
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* Payment history */}
      {settlements.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Payment history
          </h2>
          <Card className="gap-0 p-0">
            <ul className="divide-y">
              {settlements.map((s) => (
                <SettlementItem
                  key={s.id}
                  settlement={s}
                  groupId={groupId}
                  baseCurrency={baseCurrency}
                  nameOf={nameOf}
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
        groupId={groupId}
        baseCurrency={baseCurrency}
        members={members}
        currentUserId={currentUserId}
      />
    </div>
  );
}

function SettlementItem({
  settlement: s,
  groupId,
  baseCurrency,
  nameOf,
}: {
  settlement: SettlementRow;
  groupId: string;
  baseCurrency: string;
  nameOf: (uid: string) => string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const foreign = s.currency !== baseCurrency;

  function onDelete() {
    startTransition(async () => {
      const res = await deleteSettlement(s.id, groupId);
      if (res.ok) {
        toast.success("Payment removed");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

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
        onClick={onDelete}
        disabled={pending}
        className="rounded-md p-1 text-muted-foreground hover:text-rose-500"
        aria-label="Delete payment"
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
  groupId,
  baseCurrency,
  members,
  currentUserId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefill: Prefill | null;
  groupId: string;
  baseCurrency: string;
  members: MemberUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (fromUserId === toUserId) {
      toast.error("Payer and recipient must differ.");
      return;
    }
    startTransition(async () => {
      const res = await recordSettlement({
        groupId,
        fromUserId,
        toUserId,
        amount: amountNum,
        currency,
        fxRate: Number(fxRate) || 1,
        date,
        note,
      });
      if (res.ok) {
        toast.success("Payment recorded");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            Log money that changed hands to settle a debt.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>From</Label>
              <Select value={fromUserId} onValueChange={setFromUserId}>
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
              <Label>To</Label>
              <Select value={toUserId} onValueChange={setToUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
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
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 flex flex-col gap-2">
              <Label htmlFor="s-amount">Amount</Label>
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
              <Label>Currency</Label>
              <CurrencyPicker value={currency} onChange={setCurrency} />
            </div>
          </div>

          {isForeign && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-end gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="s-fx" className="text-xs">
                    Rate (1 {currency} → {baseCurrency})
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
            <Label htmlFor="s-date">Date</Label>
            <Input
              id="s-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="s-note">Note (optional)</Label>
            <Input
              id="s-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Venmo, cash, …"
            />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={pending || amountNum <= 0 || !toUserId}
            >
              {pending ? "Saving…" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

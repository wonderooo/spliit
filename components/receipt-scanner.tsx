"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Plus, ScanLine, Trash2, X } from "lucide-react";
import type { MemberUser } from "@/lib/queries";
import {
  toMinorUnits,
  toMajorUnits,
  formatMoney,
  currencyDecimals,
  isKnownCurrency,
} from "@/lib/currency";
import { distribute } from "@/lib/splits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { cn } from "@/lib/utils";

export type ScanResult = {
  merchant: string | null;
  totalMajor: number;
  currency: string;
  splits: { userId: string; valueMajor: number }[];
};

type ScannedReceipt = {
  merchant: string | null;
  items: { name: string; price: number }[];
  tax: number | null;
  tip: number | null;
  total: number | null;
  currency: string | null;
};

type Row = {
  id: string;
  name: string;
  price: string; // major units, as typed
  assignees: Set<string>;
};

const SCAN_STAGES = [
  "Reading the receipt…",
  "Finding items & prices…",
  "Detecting the currency…",
  "Adding it all up…",
];

let rowSeq = 0;
const nextId = () => `row-${rowSeq++}`;

/** Downscale an image file and return JPEG base64 (no data: prefix) to keep
 *  the upload small and the model's token cost low. */
async function fileToBase64(file: File, maxDim = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
}

export function ReceiptScanner({
  currency,
  members,
  onApply,
}: {
  currency: string;
  members: MemberUser[];
  currentUserId: string;
  onApply: (result: ScanResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "scanning" | "review">("idle");
  const [stage, setStage] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [tax, setTax] = useState("");
  const [tip, setTip] = useState("");
  const [scanCurrency, setScanCurrency] = useState(currency);
  const [detected, setDetected] = useState(false);
  const [merchant, setMerchant] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const allMemberIds = useMemo(() => members.map((m) => m.id), [members]);

  // Advance the staged status messages while a scan is in flight.
  useEffect(() => {
    if (status !== "scanning") return;
    const id = setInterval(() => {
      setStage((s) => Math.min(s + 1, SCAN_STAGES.length - 1));
    }, 1100);
    return () => clearInterval(id);
  }, [status]);

  function reset() {
    setStatus("idle");
    setStage(0);
    setRows([]);
    setTax("");
    setTip("");
    setScanCurrency(currency);
    setDetected(false);
    setMerchant(null);
  }

  function onOpenChange(v: boolean) {
    setOpen(v);
    if (!v) reset();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setStage(0);
    setStatus("scanning");
    try {
      const imageBase64 = await fileToBase64(file);
      const res = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType: "image/jpeg", currency }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "" }));
        throw new Error(error || "Scan failed");
      }
      const data = (await res.json()) as ScannedReceipt;

      const detectedCurrency =
        data.currency && isKnownCurrency(data.currency) ? data.currency : null;
      const useCurrency = detectedCurrency ?? currency;
      setScanCurrency(useCurrency);
      setDetected(Boolean(detectedCurrency));
      setMerchant(data.merchant);

      const decimals = currencyDecimals(useCurrency);
      setRows(
        data.items.map((it) => ({
          id: nextId(),
          name: it.name,
          price: it.price.toFixed(decimals),
          assignees: new Set(allMemberIds),
        })),
      );
      setTax(data.tax ? data.tax.toFixed(decimals) : "");
      setTip(data.tip ? data.tip.toFixed(decimals) : "");
      setStatus("review");
      if (data.items.length === 0) {
        toast.info("No items detected — add them manually below.");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't scan that image.",
      );
      setStatus("idle");
    }
  }

  function toggleAssignee(rowId: string, userId: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const next = new Set(r.assignees);
        if (next.has(userId)) next.delete(userId);
        else next.add(userId);
        return { ...r, assignees: next };
      }),
    );
  }

  function updateRow(rowId: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  }

  function removeRow(rowId: string) {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { id: nextId(), name: "", price: "", assignees: new Set(allMemberIds) },
    ]);
  }

  function toMinor(v: string): number {
    if (!v.trim()) return 0;
    try {
      return Math.max(0, toMinorUnits(v, scanCurrency));
    } catch {
      return 0;
    }
  }

  // Per-member totals in minor units: each item split equally among its
  // assignees, then tax + tip distributed proportionally to item spend.
  const { perMember, totalMinor } = useMemo(() => {
    const memberItems = new Map<string, number>();
    for (const r of rows) {
      const minor = toMinor(r.price);
      const assignees = [...r.assignees];
      if (minor <= 0 || assignees.length === 0) continue;
      const shares = distribute(
        minor,
        assignees.map(() => 1),
      );
      assignees.forEach((uid, i) => {
        memberItems.set(uid, (memberItems.get(uid) ?? 0) + shares[i]);
      });
    }

    const extras = toMinor(tax) + toMinor(tip);
    const perMember = new Map(memberItems);

    if (extras > 0) {
      const ids = [...memberItems.keys()];
      if (ids.length > 0) {
        const weights = ids.map((id) => memberItems.get(id) ?? 0);
        const totalWeight = weights.reduce((a, w) => a + w, 0);
        const alloc =
          totalWeight > 0
            ? distribute(extras, weights)
            : distribute(extras, ids.map(() => 1));
        ids.forEach((id, i) => {
          perMember.set(id, (perMember.get(id) ?? 0) + alloc[i]);
        });
      }
    }

    let totalMinor = 0;
    for (const v of perMember.values()) totalMinor += v;
    return { perMember, totalMinor };
  }, [rows, tax, tip, scanCurrency]);

  function apply() {
    const splits = [...perMember.entries()]
      .filter(([, minor]) => minor > 0)
      .map(([userId, minor]) => ({
        userId,
        valueMajor: toMajorUnits(minor, scanCurrency),
      }));

    if (splits.length === 0) {
      toast.error("Assign at least one item to someone.");
      return;
    }

    onApply({
      merchant,
      totalMajor: toMajorUnits(totalMinor, scanCurrency),
      currency: scanCurrency,
      splits,
    });
    toast.success("Receipt applied as an exact split");
    onOpenChange(false);
  }

  const nameOf = (uid: string) =>
    members.find((m) => m.id === uid)?.name ?? "?";
  const initialsOf = (uid: string) =>
    nameOf(uid)
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <ScanLine className="size-4" />
          Scan receipt
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92svh] gap-4 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Scan a receipt</DialogTitle>
          <DialogDescription>
            Snap the receipt — items and currency are read automatically. Tap
            who shared each one, then apply as an exact split.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFile}
        />

        {status === "idle" && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center transition-colors hover:border-foreground/30"
          >
            <Camera className="size-7 text-muted-foreground" />
            <span className="text-sm font-medium">Take or choose a photo</span>
            <span className="text-xs text-muted-foreground">
              A flat, well-lit photo reads best.
            </span>
          </button>
        )}

        {status === "scanning" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ScanLine className="size-4 animate-pulse text-primary" />
              <span className="transition-all">{SCAN_STAGES[stage]}</span>
            </div>

            {/* Indeterminate progress bar */}
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
              <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-primary animate-[indeterminate-bar_1.2s_ease-in-out_infinite]" />
            </div>

            {/* Skeleton rows mirror the review layout for a seamless reveal */}
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex flex-col gap-2 rounded-lg border p-2.5"
                  style={{ opacity: 1 - i * 0.25 }}
                >
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-7 flex-1" />
                    <Skeleton className="h-7 w-16" />
                  </div>
                  <div className="flex gap-1">
                    <Skeleton className="size-5 rounded-full" />
                    <Skeleton className="size-5 rounded-full" />
                    <Skeleton className="size-5 rounded-full" />
                  </div>
                </div>
              ))}
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Usually a few seconds. Hang tight.
            </p>
          </div>
        )}

        {status === "review" && (
          <div className="flex flex-col gap-3">
            {/* Detected currency — editable */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <Label className="text-xs text-muted-foreground">
                  Currency
                </Label>
                {detected && (
                  <span className="text-[11px] text-muted-foreground">
                    Detected from the receipt
                  </span>
                )}
              </div>
              <div className="w-36">
                <CurrencyPicker
                  value={scanCurrency}
                  onChange={setScanCurrency}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-2 rounded-lg border p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={r.name}
                      onChange={(e) =>
                        updateRow(r.id, { name: e.target.value })
                      }
                      placeholder="Item"
                      className="h-8 flex-1"
                    />
                    <Input
                      value={r.price}
                      onChange={(e) =>
                        updateRow(r.id, { price: e.target.value })
                      }
                      inputMode="decimal"
                      placeholder="0.00"
                      className="h-8 w-20 text-right"
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(r.id)}
                      className="rounded-md p-1 text-muted-foreground hover:text-rose-500"
                      aria-label="Remove item"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {members.map((m) => {
                      const on = r.assignees.has(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleAssignee(r.id, m.id)}
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-xs transition-colors",
                            on
                              ? "border-primary bg-primary text-primary-foreground"
                              : "text-muted-foreground",
                          )}
                          title={nameOf(m.id)}
                        >
                          {initialsOf(m.id)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addRow}
                className="self-start"
              >
                <Plus className="size-4" />
                Add item
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="r-tax" className="text-xs">
                  Tax
                </Label>
                <Input
                  id="r-tax"
                  value={tax}
                  onChange={(e) => setTax(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="h-8"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="r-tip" className="text-xs">
                  Tip
                </Label>
                <Input
                  id="r-tip"
                  value={tip}
                  onChange={(e) => setTip(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="h-8"
                />
              </div>
            </div>

            {/* Per-person preview */}
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="mb-1 flex items-center justify-between text-sm font-medium">
                <span>Total</span>
                <span className="tabular-nums">
                  {formatMoney(totalMinor, scanCurrency)}
                </span>
              </div>
              <ul className="flex flex-col gap-0.5">
                {[...perMember.entries()]
                  .filter(([, v]) => v > 0)
                  .map(([uid, minor]) => (
                    <li
                      key={uid}
                      className="flex justify-between text-xs text-muted-foreground"
                    >
                      <span>{nameOf(uid)}</span>
                      <span className="tabular-nums">
                        {formatMoney(minor, scanCurrency)}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => fileRef.current?.click()}
              >
                <X className="size-4" />
                Rescan
              </Button>
              <Button type="button" onClick={apply} disabled={totalMinor <= 0}>
                Apply exact split
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatMoney, normalizeDecimalInput } from "@/lib/currency";

/**
 * Compact inline editor for a foreign-currency exchange rate:
 *
 *   1 USD = [ 0.92 ] EUR                → €46.00
 *
 * `label` is the accessible name for the rate input (visually the row reads
 * as an equation, so no separate visible label is needed).
 */
export function FxRateField({
  id,
  currency,
  baseCurrency,
  value,
  onChange,
  baseAmount,
  label,
}: {
  id: string;
  currency: string;
  baseCurrency: string;
  value: string;
  onChange: (value: string) => void;
  baseAmount: number;
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <label htmlFor={id} className="whitespace-nowrap text-muted-foreground">
        1 {currency} =
      </label>
      <Input
        id={id}
        aria-label={label}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(normalizeDecimalInput(e.target.value))}
        className="w-24"
      />
      <span className="text-muted-foreground">{baseCurrency}</span>
      <span className="ml-auto flex items-center gap-1.5 tabular-nums text-muted-foreground">
        <ArrowRight className="size-3.5" aria-hidden />
        <span className="font-medium text-foreground">
          {formatMoney(baseAmount, baseCurrency)}
        </span>
      </span>
    </div>
  );
}

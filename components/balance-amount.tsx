import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/currency";

/**
 * Colored signed balance: green when the user is owed (positive), red when they
 * owe (negative), muted when settled. `minor` is in the currency's minor units.
 */
export function BalanceAmount({
  minor,
  currency,
  className,
  showSign = false,
}: {
  minor: number;
  currency: string;
  className?: string;
  showSign?: boolean;
}) {
  const settled = minor === 0;
  const positive = minor > 0;
  const formatted = formatMoney(Math.abs(minor), currency);

  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        settled && "text-muted-foreground",
        !settled && positive && "text-emerald-600 dark:text-emerald-400",
        !settled && !positive && "text-rose-600 dark:text-rose-400",
        className,
      )}
    >
      {settled ? formatMoney(0, currency) : null}
      {!settled && (showSign ? (positive ? "+" : "−") : !positive ? "−" : "")}
      {!settled ? formatted : null}
    </span>
  );
}

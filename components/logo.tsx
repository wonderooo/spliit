import { Split } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Spliit brand mark: the Lucide "split" arrow in white on the brand gradient
 * squircle. The icon scales with the box, so size it via `className`
 * (e.g. `size-6`, `size-12`). Used in the header, landing, and as the favicon
 * (kept in sync with app/icon.svg).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 via-fuchsia-500 to-blue-500 text-white shadow-sm ring-1 ring-white/10",
        className,
      )}
    >
      <Split className="size-[58%]" strokeWidth={2.5} aria-hidden />
    </span>
  );
}

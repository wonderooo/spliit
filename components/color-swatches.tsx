"use client";

import { Check } from "lucide-react";
import { MEMBER_COLORS } from "@/lib/member-colors";
import { cn } from "@/lib/utils";

/** A row of selectable accent-color dots from the member palette. */
export function ColorSwatches({
  value,
  onChange,
  className,
  disabled,
}: {
  value: string | null | undefined;
  onChange: (color: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {MEMBER_COLORS.map((c) => {
        const selected = c === value;
        return (
          <button
            key={c}
            type="button"
            disabled={disabled}
            onClick={() => onChange(c)}
            aria-label={c}
            aria-pressed={selected}
            className={cn(
              "flex size-7 items-center justify-center rounded-full outline-none transition",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              selected
                ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                : "opacity-80 hover:opacity-100",
            )}
            style={{ backgroundColor: `var(--member-${c})` }}
          >
            {selected && <Check className="size-4 text-white" />}
          </button>
        );
      })}
    </div>
  );
}

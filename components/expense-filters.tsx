"use client";

import { ArrowDownUp, SlidersHorizontal } from "lucide-react";
import type { MemberUser } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

export type SortOption = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";
export type FilterType = "all" | "shared" | "personal";
export type FilterScope = "mine" | "everyone";

export function ExpenseFilters({
  scope,
  onScopeChange,
  sort,
  onSortChange,
  filterType,
  onFilterTypeChange,
  filterPayer,
  onFilterPayerChange,
  payers,
  currentUserId,
}: {
  scope: FilterScope;
  onScopeChange: (value: FilterScope) => void;
  sort: SortOption;
  onSortChange: (value: SortOption) => void;
  filterType: FilterType;
  onFilterTypeChange: (value: FilterType) => void;
  filterPayer: string;
  onFilterPayerChange: (value: string) => void;
  payers: MemberUser[];
  currentUserId: string;
}) {
  const t = useT();
  // "mine" is the default scope, so only "everyone" counts as an active filter.
  const activeFilters =
    (scope !== "mine" ? 1 : 0) +
    (filterType !== "all" ? 1 : 0) +
    (filterPayer !== "all" ? 1 : 0);

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label={t.expenseFilters.sortLabel}
          >
            <ArrowDownUp className="size-4" />
            <span className="hidden sm:inline">
              {t.expenseFilters.sortLabel}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-44">
          <DropdownMenuRadioGroup
            value={sort}
            onValueChange={(v) => onSortChange(v as SortOption)}
          >
            <DropdownMenuRadioItem value="date-desc">
              {t.expenseFilters.sortNewest}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="date-asc">
              {t.expenseFilters.sortOldest}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="amount-desc">
              {t.expenseFilters.sortAmountDesc}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="amount-asc">
              {t.expenseFilters.sortAmountAsc}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label={t.expenseFilters.filterLabel}
          >
            <SlidersHorizontal className="size-4" />
            <span className="hidden sm:inline">
              {t.expenseFilters.filterLabel}
            </span>
            {activeFilters > 0 ? (
              <Badge className="ml-0.5 size-4 justify-center rounded-full p-0 text-[10px] tabular-nums">
                {activeFilters}
              </Badge>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-44">
          <DropdownMenuLabel>{t.expenseFilters.scopeLabel}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={scope}
            onValueChange={(v) => onScopeChange(v as FilterScope)}
          >
            <DropdownMenuRadioItem value="mine">
              {t.expenseFilters.scopeMine}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="everyone">
              {t.expenseFilters.scopeEveryone}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />

          <DropdownMenuLabel>{t.expenseFilters.typeLabel}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={filterType}
            onValueChange={(v) => onFilterTypeChange(v as FilterType)}
          >
            <DropdownMenuRadioItem value="all">
              {t.expenseFilters.typeAll}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="shared">
              {t.expenseFilters.typeShared}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="personal">
              {t.expenseFilters.typeOwn}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />

          <DropdownMenuLabel>{t.expenseFilters.payerLabel}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={filterPayer}
            onValueChange={onFilterPayerChange}
          >
            <DropdownMenuRadioItem value="all">
              {t.expenseFilters.payerAll}
            </DropdownMenuRadioItem>
            {payers.map((m) => (
              <DropdownMenuRadioItem key={m.id} value={m.id}>
                <span className={cn(m.removed && "line-through")}>
                  {m.id === currentUserId ? t.common.you : m.name}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

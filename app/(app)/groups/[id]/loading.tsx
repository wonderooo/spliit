import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Expenses tab: the add/scan/own toolbar + sort/filter, then the expense list. */
export default function ExpensesLoading() {
  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar, mirroring ExpensesView. Mobile: row 1 = scan + own (50/50),
          row 2 = add (majority) + icon-only sort/filter. Desktop: one row with
          add actions left and sort/filter pushed right. */}
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <Skeleton className="order-2 h-8 flex-1 rounded-lg sm:order-1 sm:w-36 sm:flex-none" />
        <Skeleton className="order-1 h-8 min-w-0 flex-1 basis-[calc(50%-0.25rem)] rounded-lg sm:order-2 sm:w-32 sm:flex-none sm:basis-auto" />
        <Skeleton className="order-1 h-8 min-w-0 flex-1 basis-[calc(50%-0.25rem)] rounded-lg sm:order-3 sm:w-32 sm:flex-none sm:basis-auto" />
        <div className="order-3 flex gap-2 sm:order-4 sm:ml-auto">
          <Skeleton className="h-7 w-9 rounded-lg sm:w-20" />
          <Skeleton className="h-7 w-9 rounded-lg sm:w-20" />
        </div>
      </div>

      {/* Expense rows */}
      <ul className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i}>
            <Card className="flex-row items-center gap-3 p-3.5">
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-5 w-16" />
              <Skeleton className="size-4 shrink-0" />
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

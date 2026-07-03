import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Expenses tab: the add/scan/own toolbar + sort/filter, then the expense list. */
export default function ExpensesLoading() {
  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar: add actions on the left, sort/filter on the right */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-36 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
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

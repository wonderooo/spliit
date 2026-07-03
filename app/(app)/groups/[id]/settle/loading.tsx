import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Settle tab: suggested payments list, then payment history. */
export default function SettleLoading() {
  return (
    <div className="flex flex-col gap-5">
      {/* Suggested payments */}
      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-4 w-36" />
          {/* Record button (icon-only on mobile) + mine/everyone toggle */}
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-7 w-9 rounded-md sm:w-36" />
            <Skeleton className="h-6 w-28 rounded-md" />
          </div>
        </div>
        <Card className="gap-0 p-0">
          <ul className="divide-y">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-2 px-4 py-3">
                <div className="flex flex-1 items-center gap-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="size-4 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-7 w-16 rounded-md" />
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* Payment history */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-28 rounded-md" />
        </div>
        <Card className="gap-0 p-0">
          <ul className="divide-y">
            {[0, 1].map((i) => (
              <li key={i} className="flex items-center gap-2 px-4 py-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-14" />
                <Skeleton className="size-4 shrink-0" />
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}

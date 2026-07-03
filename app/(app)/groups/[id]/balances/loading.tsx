import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Balances tab: per-member balance rows, then the settle-up CTA card. */
export default function BalancesLoading() {
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Card className="gap-0 p-0">
          <ul className="divide-y">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* Settle CTA / all-settled card */}
      <Card className="flex flex-col items-center gap-3 p-8">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </Card>
    </div>
  );
}

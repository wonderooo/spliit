import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Members tab: the "Members (n)" header + Invite, then the member rows. */
export default function MembersLoading() {
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
        <Card className="gap-0 p-0">
          <ul className="divide-y">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <Skeleton className="h-5 w-14 rounded-md" />
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}

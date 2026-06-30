import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function GroupLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-9 w-full rounded-md sm:w-36" />
      <ul className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <li key={i}>
            <Card className="flex-row items-center gap-3 p-3.5">
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-5 w-16" />
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

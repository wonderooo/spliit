import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getUserGroups, getGroupBalances } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BalanceAmount } from "@/components/balance-amount";
import { GroupCard } from "@/components/group-card";
import { Plus, Users } from "lucide-react";

export default async function DashboardPage() {
  const dict = await getDictionary();
  const user = await requireUser();
  const groups = await getUserGroups(user.id);

  const withBalances = await Promise.all(
    groups.map(async (g) => {
      const { net } = await getGroupBalances(g.id);
      return { ...g, userNet: net.get(user.id) ?? 0 };
    }),
  );

  // Overall totals grouped by base currency (groups can differ).
  const totals = new Map<string, number>();
  for (const g of withBalances) {
    totals.set(g.baseCurrency, (totals.get(g.baseCurrency) ?? 0) + g.userNet);
  }
  const totalsList = [...totals.entries()].filter(([, v]) => v !== 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          {dict.pages.dashboard.title}
        </h1>
        <Button asChild size="sm">
          <Link href="/groups/new">
            <Plus className="size-4" />
            {dict.pages.dashboard.newGroup}
          </Link>
        </Button>
      </div>

      {/* Overall summary */}
      {totalsList.length > 0 && (
        <Card className="gap-3 p-5">
          <p className="text-sm text-muted-foreground">
            {dict.pages.dashboard.overallBalance}
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {totalsList.map(([currency, amount]) => (
              <div key={currency} className="flex flex-col">
                <BalanceAmount
                  minor={amount}
                  currency={currency}
                  className="text-2xl"
                  showSign
                />
                <span className="text-xs text-muted-foreground">
                  {amount > 0
                    ? dict.pages.dashboard.youAreOwed
                    : dict.pages.dashboard.youOwe}{" "}
                  · {currency}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Group list */}
      {withBalances.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Users className="size-6" />
          </div>
          <div>
            <p className="font-semibold">{dict.pages.dashboard.emptyTitle}</p>
            <p className="text-sm text-muted-foreground">
              {dict.pages.dashboard.emptyBody}
            </p>
          </div>
          <Button asChild>
            <Link href="/groups/new">
              <Plus className="size-4" />
              {dict.pages.dashboard.createGroup}
            </Link>
          </Button>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {withBalances.map((g) => (
            <li key={g.id}>
              <GroupCard
                id={g.id}
                name={g.name}
                description={g.description}
                baseCurrency={g.baseCurrency}
                userNet={g.userNet}
                role={g.role}
                createdAt={g.createdAt}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";

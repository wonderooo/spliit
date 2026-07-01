import { requireUser } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getGroup, getGroupMembers, getGroupBalances } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { BalanceAmount } from "@/components/balance-amount";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeftRight, PartyPopper } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function BalancesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const dict = await getDictionary();

  const [group, members, { net, transactions }] = await Promise.all([
    getGroup(id),
    getGroupMembers(id),
    getGroupBalances(id),
  ]);
  if (!group) return null;

  const cur = group.baseCurrency;
  const allSettled = transactions.length === 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Per-member balances */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {dict.pages.balances.balancesHeading}
        </h2>
        <Card className="gap-0 p-0">
          <ul className="divide-y">
            {members.map((m) => {
              const bal = net.get(m.id) ?? 0;
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <Avatar className="size-8">
                    {m.image ? <AvatarImage src={m.image} alt={m.name} /> : null}
                    <AvatarFallback className="text-xs">
                      {initials(m.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-sm">
                    {m.id === user.id ? dict.common.you : m.name}
                  </span>
                  <div className="text-right">
                    <BalanceAmount minor={bal} currency={cur} showSign />
                    <p className="text-xs text-muted-foreground">
                      {bal === 0
                        ? dict.pages.balances.settled
                        : bal > 0
                          ? dict.pages.balances.getsBack
                          : dict.pages.balances.owes}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>

      {/* Settle-up: celebrate when done, otherwise point to the Settle tab */}
      {allSettled ? (
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <PartyPopper className="size-6 text-emerald-500" />
          <p className="font-semibold">{dict.pages.balances.allSettledTitle}</p>
          <p className="text-sm text-muted-foreground">
            {dict.pages.balances.allSettledBody}
          </p>
        </Card>
      ) : (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <ArrowLeftRight className="size-6 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold">
              {dict.pages.balances.settleCtaTitle}
            </p>
            <p className="text-sm text-muted-foreground">
              {dict.pages.balances.settleCtaBody}
            </p>
          </div>
          <Button asChild>
            <Link href={`/groups/${id}/settle`}>
              {dict.nav.settle}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </Card>
      )}
    </div>
  );
}

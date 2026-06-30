import { requireUser } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getGroup, getGroupMembers, getGroupBalances } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { BalanceAmount } from "@/components/balance-amount";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowRight, PartyPopper } from "lucide-react";
import { formatMoney } from "@/lib/currency";

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
  const nameOf = (uid: string) =>
    uid === user.id
      ? dict.common.you
      : (members.find((m) => m.id === uid)?.name ??
        dict.pages.balances.someone);

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

      {/* Simplified settle-up plan */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {dict.pages.balances.suggestedPayments}
        </h2>
        {allSettled ? (
          <Card className="flex flex-col items-center gap-2 p-8 text-center">
            <PartyPopper className="size-6 text-emerald-500" />
            <p className="font-semibold">
              {dict.pages.balances.allSettledTitle}
            </p>
            <p className="text-sm text-muted-foreground">
              {dict.pages.balances.allSettledBody}
            </p>
          </Card>
        ) : (
          <Card className="gap-0 p-0">
            <ul className="divide-y">
              {transactions.map((t, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 px-4 py-3 text-sm"
                >
                  <span className="font-medium">{nameOf(t.from)}</span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                  <span className="font-medium">{nameOf(t.to)}</span>
                  <span className="ml-auto font-semibold tabular-nums">
                    {formatMoney(t.amount, cur)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}

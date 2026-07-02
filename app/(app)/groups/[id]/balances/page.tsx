import { requireUser } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getGroup, getGroupMembers, getGroupBalances } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { BalanceAmount } from "@/components/balance-amount";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeftRight, PartyPopper } from "lucide-react";
import Link from "next/link";
import { memberColorStyle, memberAvatarStyle } from "@/lib/member-colors";
import { formatMoney } from "@/lib/currency";
import { format } from "@/lib/i18n/config";

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

  const [group, members, { net, transactions, personalSpending }] =
    await Promise.all([
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
            {members
              .filter(
                (m) =>
                  !m.removed ||
                  (net.get(m.id) ?? 0) !== 0 ||
                  (personalSpending.get(m.id) ?? 0) !== 0,
              )
              .map((m) => {
              const bal = net.get(m.id) ?? 0;
              const spent = personalSpending.get(m.id) ?? 0;
              const displayName =
                m.id === user.id
                  ? dict.common.you
                  : m.removed
                    ? `${m.name} ${dict.common.removedSuffix}`
                    : m.name;
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <Avatar className="size-8">
                    {m.image ? <AvatarImage src={m.image} alt={m.name} /> : null}
                    <AvatarFallback
                      className="text-xs"
                      style={memberAvatarStyle(m.removed ? null : m.color)}
                    >
                      {initials(m.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <span
                      className="block truncate text-sm font-medium"
                      style={memberColorStyle(m.removed ? null : m.color)}
                    >
                      {displayName}
                    </span>
                    {spent > 0 ? (
                      <span className="block text-xs text-muted-foreground">
                        {format(dict.pages.balances.ownSpending, {
                          amount: formatMoney(spent, cur),
                        })}
                      </span>
                    ) : null}
                  </div>
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

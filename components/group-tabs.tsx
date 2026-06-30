"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";

export function GroupTabs({ groupId }: { groupId: string }) {
  const pathname = usePathname();
  const t = useT();
  const base = `/groups/${groupId}`;
  const tabs = [
    { href: base, label: t.nav.expenses },
    { href: `${base}/balances`, label: t.nav.balances },
    { href: `${base}/settle`, label: t.nav.settle },
    { href: `${base}/members`, label: t.nav.members },
  ];

  return (
    <nav className="-mx-4 overflow-x-auto px-4">
      <div className="flex min-w-max gap-1 border-b">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "relative px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {active && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

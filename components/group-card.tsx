"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreVertical, LogOut, ArrowRight } from "lucide-react";
import { leaveGroup } from "@/server/actions/members";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BalanceAmount } from "@/components/balance-amount";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/components/i18n-provider";
import { localeToIntl, format } from "@/lib/i18n/config";
import { errorText } from "@/lib/action-result";

export function GroupCard({
  id,
  name,
  description,
  baseCurrency,
  userNet,
  role,
  createdAt,
}: {
  id: string;
  name: string;
  description: string | null;
  baseCurrency: string;
  userNet: number;
  role: string;
  createdAt: Date;
}) {
  const { dict: t, locale } = useI18n();
  const router = useRouter();
  const createdOn = format(t.pages.dashboard.createdOn, {
    date: new Intl.DateTimeFormat(localeToIntl[locale], {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(createdAt),
  });
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, startLeave] = useTransition();
  // The owner can't leave their own group (would orphan owner-only controls).
  const canLeave = role !== "owner";

  function confirmLeave() {
    startLeave(async () => {
      const res = await leaveGroup({ groupId: id });
      if (res.ok) {
        toast.success(t.membersPanel.leftGroup);
        setLeaveOpen(false);
        router.refresh();
      } else {
        toast.error(errorText(t, res.error));
      }
    });
  }

  return (
    <Card className="relative flex-row items-center justify-between gap-3 p-4 transition-colors hover:border-foreground/20">
      {/* Stretched overlay link: the whole card navigates, while the actions
          menu sits above it (z-10) and stays clickable. */}
      <Link
        href={`/groups/${id}`}
        aria-label={name}
        className="absolute inset-0 rounded-[inherit]"
      />
      <div className="min-w-0">
        <p className="truncate font-semibold">{name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {baseCurrency}
          {description ? ` · ${description}` : ""}
          {` · ${createdOn}`}
        </p>
      </div>
      <div className="relative z-10 flex items-center gap-2">
        <div className="text-right">
          {userNet === 0 ? (
            <span className="text-sm text-muted-foreground">
              {t.pages.dashboard.settledUp}
            </span>
          ) : (
            <>
              <BalanceAmount minor={userNet} currency={baseCurrency} />
              <p className="text-xs text-muted-foreground">
                {userNet > 0
                  ? t.pages.dashboard.youAreOwed
                  : t.pages.dashboard.youOwe}
              </p>
            </>
          )}
        </div>
        {canLeave ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground"
                aria-label={t.membersPanel.leave}
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setLeaveOpen(true)}
              >
                <LogOut className="size-4" />
                {t.membersPanel.leave}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <ArrowRight className="size-4 text-muted-foreground" />
        )}
      </div>

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.membersPanel.leaveTitle}</DialogTitle>
            <DialogDescription>{t.membersPanel.leaveBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              disabled={leaving}
              onClick={() => setLeaveOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={leaving}
              onClick={confirmLeave}
            >
              {t.membersPanel.leave}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

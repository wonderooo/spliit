"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { acceptInvite } from "@/server/actions/invites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorSwatches } from "@/components/color-swatches";
import { MEMBER_COLORS } from "@/lib/member-colors";
import { useT } from "@/components/i18n-provider";
import { errorText } from "@/lib/action-result";

export function AcceptInvite({
  token,
  defaultName,
}: {
  token: string;
  defaultName: string;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(defaultName);
  const [color, setColor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pre-select a random color on mount (client-only, avoids a hydration
  // mismatch). The user can change it; the server auto-assigns if it's absent.
  useEffect(() => {
    setColor(MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)]);
  }, []);

  function onAccept(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await acceptInvite(token, name, color ?? undefined);
      if (res.ok) {
        toast.success(
          res.data.alreadyMember
            ? t.acceptInvite.alreadyMember
            : t.acceptInvite.joined,
        );
        router.push(`/groups/${res.data.groupId}`);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={onAccept} className="flex w-full flex-col gap-3 text-left">
      <div className="flex flex-col gap-2">
        <Label htmlFor="member-name">{t.acceptInvite.nameLabel}</Label>
        <Input
          id="member-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder={t.acceptInvite.namePlaceholder}
        />
        <p className="text-xs text-muted-foreground">
          {t.acceptInvite.nameHelp}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t.acceptInvite.colorLabel}</Label>
        <ColorSwatches value={color} onChange={setColor} />
      </div>
      <Button type="submit" disabled={pending || name.trim() === ""} size="lg">
        {pending ? t.acceptInvite.joining : t.acceptInvite.joinGroup}
      </Button>
      {error && (
        <p className="text-sm text-rose-500">{errorText(t, error)}</p>
      )}
    </form>
  );
}

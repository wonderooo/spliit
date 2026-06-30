"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { acceptInvite } from "@/server/actions/invites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AcceptInvite({
  token,
  defaultName,
}: {
  token: string;
  defaultName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string | null>(null);

  function onAccept(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await acceptInvite(token, name);
      if (res.ok) {
        toast.success(
          res.data.alreadyMember
            ? "You're already in this group"
            : "You've joined the group",
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
        <Label htmlFor="member-name">Your name in this group</Label>
        <Input
          id="member-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="e.g. Alex"
        />
        <p className="text-xs text-muted-foreground">
          This is how you&apos;ll show up to the group. You can change it later.
        </p>
      </div>
      <Button type="submit" disabled={pending || name.trim() === ""} size="lg">
        {pending ? "Joining…" : "Join group"}
      </Button>
      {error && <p className="text-sm text-rose-500">{error}</p>}
    </form>
  );
}

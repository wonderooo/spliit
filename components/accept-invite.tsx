"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { acceptInvite } from "@/server/actions/invites";
import { Button } from "@/components/ui/button";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onAccept() {
    setError(null);
    startTransition(async () => {
      const res = await acceptInvite(token);
      if (res.ok) {
        toast.success("You've joined the group");
        router.push(`/groups/${res.data.groupId}`);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={onAccept} disabled={pending} size="lg">
        {pending ? "Joining…" : "Join group"}
      </Button>
      {error && <p className="text-sm text-rose-500">{error}</p>}
    </div>
  );
}

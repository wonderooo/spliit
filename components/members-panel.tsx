"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Mail, UserPlus, X, Check } from "lucide-react";
import { createInvite, revokeInvite } from "@/server/actions/invites";
import type { MemberUser } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type PendingInvite = { id: string; email: string | null; token: string };

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function MembersPanel({
  groupId,
  members,
  invites,
  currentUserId,
  ownerId,
}: {
  groupId: string;
  members: MemberUser[];
  invites: PendingInvite[];
  currentUserId: string;
  ownerId: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Members ({members.length})
          </h2>
          <InviteDialog groupId={groupId} />
        </div>
        <Card className="gap-0 p-0">
          <ul className="divide-y">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar className="size-8">
                  {m.image ? <AvatarImage src={m.image} alt={m.name} /> : null}
                  <AvatarFallback className="text-xs">
                    {initials(m.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.id === currentUserId ? "You" : m.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.email}
                  </p>
                </div>
                {m.id === ownerId && <Badge variant="secondary">Owner</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {invites.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Pending invites
          </h2>
          <Card className="gap-0 p-0">
            <ul className="divide-y">
              {invites.map((inv) => (
                <PendingInviteRow
                  key={inv.id}
                  invite={inv}
                  groupId={groupId}
                />
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}

function inviteLink(token: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/invite/${token}`;
}

function PendingInviteRow({
  invite,
  groupId,
}: {
  invite: PendingInvite;
  groupId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(inviteLink(invite.token));
    setCopied(true);
    toast.success("Invite link copied");
    setTimeout(() => setCopied(false), 1500);
  }

  function revoke() {
    startTransition(async () => {
      const res = await revokeInvite(invite.id, groupId);
      if (res.ok) {
        toast.success("Invite revoked");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <li className="flex items-center gap-2 px-4 py-3">
      <Mail className="size-4 text-muted-foreground" />
      <span className="flex-1 truncate text-sm">
        {invite.email || "Anyone with the link"}
      </span>
      <Button size="sm" variant="ghost" onClick={copy}>
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        Link
      </Button>
      <button
        onClick={revoke}
        disabled={pending}
        className="rounded-md p-1 text-muted-foreground hover:text-rose-500"
        aria-label="Revoke invite"
      >
        <X className="size-4" />
      </button>
    </li>
  );
}

function InviteDialog({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createInvite({ groupId, email });
      if (res.ok) {
        setLink(inviteLink(res.data.token));
        toast.success("Invite link created");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function onOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setEmail("");
      setLink(null);
      setCopied(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="size-4" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite someone</DialogTitle>
          <DialogDescription>
            Create a link to share. They sign in with Google to join — the link
            works for 7 days.
          </DialogDescription>
        </DialogHeader>

        {!link ? (
          <form onSubmit={onCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-email">Email (optional)</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="friend@example.com"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank and anyone with the link can join. Set an email to
                lock the link to that one person.
              </p>
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create invite link"}
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input readOnly value={link} className="text-xs" />
              <Button
                size="icon"
                variant="secondary"
                onClick={copy}
                aria-label="Copy invite link"
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

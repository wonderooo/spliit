"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Mail, UserPlus, X, Check, Pencil } from "lucide-react";
import { createInvite, revokeInvite } from "@/server/actions/invites";
import { updateMemberName } from "@/server/actions/members";
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
import { useT } from "@/components/i18n-provider";
import { errorText } from "@/lib/action-result";
import { format } from "@/lib/i18n/config";

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
  const t = useT();
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {format(t.membersPanel.membersCount, { count: members.length })}
          </h2>
          <InviteDialog groupId={groupId} />
        </div>
        <Card className="gap-0 p-0">
          <ul className="divide-y">
            {members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                groupId={groupId}
                isCurrentUser={m.id === currentUserId}
                isOwner={m.id === ownerId}
              />
            ))}
          </ul>
        </Card>
      </section>

      {invites.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t.membersPanel.pendingInvites}
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

function MemberRow({
  member,
  groupId,
  isCurrentUser,
  isOwner,
}: {
  member: MemberUser;
  groupId: string;
  isCurrentUser: boolean;
  isOwner: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(member.name);
  const [pending, startTransition] = useTransition();

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    const next = name.trim();
    if (next === "" || next === member.name) {
      setEditing(false);
      setName(member.name);
      return;
    }
    startTransition(async () => {
      const res = await updateMemberName({ groupId, name: next });
      if (res.ok) {
        toast.success(t.membersPanel.nameUpdated);
        setEditing(false);
        router.refresh();
      } else {
        toast.error(errorText(t, res.error));
      }
    });
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Avatar className="size-8">
        {member.image ? (
          <AvatarImage src={member.image} alt={member.name} />
        ) : null}
        <AvatarFallback className="text-xs">
          {initials(member.name)}
        </AvatarFallback>
      </Avatar>
      {editing ? (
        <form onSubmit={onSave} className="flex flex-1 items-center gap-2">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            disabled={pending}
            className="h-8"
          />
          <Button type="submit" size="sm" disabled={pending}>
            {t.common.save}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setEditing(false);
              setName(member.name);
            }}
          >
            {t.common.cancel}
          </Button>
        </form>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {member.name}
              {isCurrentUser && (
                <span className="text-muted-foreground">
                  {" "}
                  {t.membersPanel.youSuffix}
                </span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {member.email}
            </p>
          </div>
          {isOwner && <Badge variant="secondary">{t.membersPanel.owner}</Badge>}
          {isCurrentUser && (
            <button
              onClick={() => setEditing(true)}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              aria-label={t.membersPanel.editYourName}
            >
              <Pencil className="size-4" />
            </button>
          )}
        </>
      )}
    </li>
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
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(inviteLink(invite.token));
    setCopied(true);
    toast.success(t.membersPanel.inviteLinkCopied);
    setTimeout(() => setCopied(false), 1500);
  }

  function revoke() {
    startTransition(async () => {
      const res = await revokeInvite(invite.id, groupId);
      if (res.ok) {
        toast.success(t.membersPanel.inviteRevoked);
        router.refresh();
      } else {
        toast.error(errorText(t, res.error));
      }
    });
  }

  return (
    <li className="flex items-center gap-2 px-4 py-3">
      <Mail className="size-4 text-muted-foreground" />
      <span className="flex-1 truncate text-sm">
        {invite.email || t.membersPanel.anyoneWithLink}
      </span>
      <Button size="sm" variant="ghost" onClick={copy}>
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {t.membersPanel.link}
      </Button>
      <button
        onClick={revoke}
        disabled={pending}
        className="rounded-md p-1 text-muted-foreground hover:text-rose-500"
        aria-label={t.membersPanel.revokeInvite}
      >
        <X className="size-4" />
      </button>
    </li>
  );
}

function InviteDialog({ groupId }: { groupId: string }) {
  const t = useT();
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
        toast.success(t.membersPanel.inviteLinkCreated);
        router.refresh();
      } else {
        toast.error(errorText(t, res.error));
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
          {t.membersPanel.invite}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.membersPanel.inviteTitle}</DialogTitle>
          <DialogDescription>{t.membersPanel.inviteDescription}</DialogDescription>
        </DialogHeader>

        {!link ? (
          <form onSubmit={onCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-email">{t.membersPanel.emailLabel}</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.membersPanel.emailPlaceholder}
              />
              <p className="text-xs text-muted-foreground">
                {t.membersPanel.emailHelp}
              </p>
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? t.membersPanel.creating : t.membersPanel.createInviteLink}
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
                aria-label={t.membersPanel.copyInviteLink}
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t.common.done}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

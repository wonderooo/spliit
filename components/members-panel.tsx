"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  Copy,
  Mail,
  UserPlus,
  UserRoundPlus,
  X,
  Check,
  Pencil,
  UserMinus,
} from "lucide-react";
import { createInvite, revokeInvite } from "@/server/actions/invites";
import {
  updateMemberName,
  updateMemberColor,
  addSyntheticMember,
  mergeSyntheticMember,
  removeMember,
} from "@/server/actions/members";
import type { MemberUser } from "@/lib/queries";
import {
  memberColorStyle,
  memberAvatarStyle,
  pickMemberColor,
} from "@/lib/member-colors";
import { ColorSwatches } from "@/components/color-swatches";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const router = useRouter();
  const [toRemove, setToRemove] = useState<MemberUser | null>(null);
  const [toTransfer, setToTransfer] = useState<MemberUser | null>(null);
  const [removing, startRemove] = useTransition();

  const isOwnerViewer = currentUserId === ownerId;
  const activeCount = members.filter((m) => !m.removed).length;
  // Active members first, removed ones last.
  const ordered = [...members].sort(
    (a, b) => Number(a.removed) - Number(b.removed),
  );

  function confirmRemove() {
    if (!toRemove) return;
    const target = toRemove;
    startRemove(async () => {
      const res = await removeMember({ groupId, userId: target.id });
      if (res.ok) {
        toast.success(t.membersPanel.memberRemoved);
        setToRemove(null);
        router.refresh();
      } else {
        toast.error(errorText(t, res.error));
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {format(t.membersPanel.membersCount, { count: activeCount })}
          </h2>
          <div className="flex items-center gap-2">
            {isOwnerViewer && (
              <AddGuestDialog
                groupId={groupId}
                suggestedColor={pickMemberColor(
                  members.map((m) => m.color).filter((c): c is string => !!c),
                )}
              />
            )}
            <InviteDialog groupId={groupId} />
          </div>
        </div>
        <Card className="gap-0 p-0">
          <ul className="divide-y">
            {ordered.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                groupId={groupId}
                isCurrentUser={m.id === currentUserId}
                isOwner={m.id === ownerId}
                canEdit={
                  m.id === currentUserId ||
                  (isOwnerViewer && m.synthetic && !m.removed)
                }
                canRemove={isOwnerViewer && m.id !== currentUserId && !m.removed}
                canTransfer={isOwnerViewer && m.synthetic && !m.removed}
                onRemove={() => setToRemove(m)}
                onTransfer={() => setToTransfer(m)}
              />
            ))}
          </ul>
        </Card>
      </section>

      {toTransfer && (
        <TransferGuestDialog
          guest={toTransfer}
          groupId={groupId}
          targets={members.filter((m) => !m.removed && !m.synthetic)}
          currentUserId={currentUserId}
          onOpenChange={(o) => {
            if (!o) setToTransfer(null);
          }}
        />
      )}

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

      <Dialog
        open={toRemove != null}
        onOpenChange={(o) => {
          if (!o) setToRemove(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.membersPanel.removeTitle}</DialogTitle>
            <DialogDescription>
              {toRemove
                ? format(t.membersPanel.removeBody, { name: toRemove.name })
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              disabled={removing}
              onClick={() => setToRemove(null)}
            >
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={removing}
              onClick={confirmRemove}
            >
              {t.membersPanel.remove}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MemberRow({
  member,
  groupId,
  isCurrentUser,
  isOwner,
  canEdit,
  canRemove,
  canTransfer,
  onRemove,
  onTransfer,
}: {
  member: MemberUser;
  groupId: string;
  isCurrentUser: boolean;
  isOwner: boolean;
  canEdit: boolean;
  canRemove: boolean;
  canTransfer: boolean;
  onRemove: () => void;
  onTransfer: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(member.name);
  const [color, setColor] = useState(member.color);
  const [pending, startTransition] = useTransition();

  function cancelEdit() {
    setEditing(false);
    setName(member.name);
    setColor(member.color);
  }

  // Name and color are both staged in edit mode and committed together on Save,
  // so the whole row edits with one consistent Save/Cancel.
  function onSave(e: React.FormEvent) {
    e.preventDefault();
    const nextName = name.trim();
    const nameChanged = nextName !== "" && nextName !== member.name;
    const colorChanged = color !== member.color && color != null;
    if (!nameChanged && !colorChanged) {
      cancelEdit();
      return;
    }
    startTransition(async () => {
      // The server treats your own id as a self-edit; any other id is an
      // owner-managed guest edit.
      if (nameChanged) {
        const res = await updateMemberName({
          groupId,
          name: nextName,
          userId: member.id,
        });
        if (!res.ok) {
          toast.error(errorText(t, res.error));
          return;
        }
      }
      if (colorChanged) {
        const res = await updateMemberColor({
          groupId,
          color,
          userId: member.id,
        });
        if (!res.ok) {
          toast.error(errorText(t, res.error));
          return;
        }
      }
      toast.success(
        nameChanged ? t.membersPanel.nameUpdated : t.membersPanel.colorUpdated,
      );
      setEditing(false);
      router.refresh();
    });
  }

  // Removed members: kept visible (their data stays) but inert - no edit,
  // no color, greyed out with a badge.
  if (member.removed) {
    return (
      <li className="flex items-center gap-3 px-4 py-3 opacity-60">
        <Avatar className="size-8">
          {member.image ? (
            <AvatarImage src={member.image} alt={member.name} />
          ) : null}
          <AvatarFallback className="text-xs">
            {initials(member.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-muted-foreground">
            {member.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {member.synthetic ? t.membersPanel.guestHint : member.email}
          </p>
        </div>
        <Badge variant="secondary">{t.membersPanel.removedBadge}</Badge>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Avatar className="size-8">
        {member.image ? (
          <AvatarImage src={member.image} alt={member.name} />
        ) : null}
        <AvatarFallback className="text-xs" style={memberAvatarStyle(color)}>
          {initials(member.name)}
        </AvatarFallback>
      </Avatar>
      {editing ? (
        <form onSubmit={onSave} className="flex flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
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
              onClick={cancelEdit}
            >
              {t.common.cancel}
            </Button>
          </div>
          <ColorSwatches value={color} onChange={setColor} disabled={pending} />
        </form>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              <span style={memberColorStyle(color)}>{member.name}</span>
              {isCurrentUser && (
                <span className="text-muted-foreground">
                  {" "}
                  {t.membersPanel.youSuffix}
                </span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {member.synthetic ? t.membersPanel.guestHint : member.email}
            </p>
          </div>
          {isOwner && <Badge variant="secondary">{t.membersPanel.owner}</Badge>}
          {member.synthetic && (
            <Badge variant="outline">{t.membersPanel.guestBadge}</Badge>
          )}
          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              aria-label={
                isCurrentUser
                  ? t.membersPanel.editYourName
                  : format(t.membersPanel.editGuestAria, { name: member.name })
              }
            >
              <Pencil className="size-4" />
            </button>
          )}
          {canTransfer && (
            <button
              onClick={onTransfer}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              aria-label={format(t.membersPanel.transferAria, {
                name: member.name,
              })}
            >
              <ArrowRightLeft className="size-4" />
            </button>
          )}
          {canRemove && (
            <button
              onClick={onRemove}
              className="rounded-md p-1 text-muted-foreground hover:text-rose-500"
              aria-label={format(t.membersPanel.removeMemberAria, {
                name: member.name,
              })}
            >
              <UserMinus className="size-4" />
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

/** Owner-only: move a guest's expenses and payments to a signed-in member,
 *  deleting the guest afterwards. */
function TransferGuestDialog({
  guest,
  groupId,
  targets,
  currentUserId,
  onOpenChange,
}: {
  guest: MemberUser;
  groupId: string;
  targets: MemberUser[];
  currentUserId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [targetUserId, setTargetUserId] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await mergeSyntheticMember({
        groupId,
        guestId: guest.id,
        targetUserId,
      });
      if (res.ok) {
        toast.success(t.membersPanel.guestTransferred);
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(errorText(t, res.error));
      }
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.membersPanel.transferTitle}</DialogTitle>
          <DialogDescription>
            {format(t.membersPanel.transferDescription, { name: guest.name })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>{t.membersPanel.transferToLabel}</Label>
            <Select value={targetUserId} onValueChange={setTargetUserId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t.settleUp.selectPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {targets.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.id === currentUserId ? t.common.you : m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={pending || !targetUserId}>
            {pending
              ? t.membersPanel.transferring
              : t.membersPanel.transferSubmit}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Owner-only: add a guest member (no account, no sign-in) by name. */
function AddGuestDialog({
  groupId,
  suggestedColor,
}: {
  groupId: string;
  suggestedColor: string;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [color, setColor] = useState(suggestedColor);

  function onOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setName("");
      setColor(suggestedColor);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await addSyntheticMember({ groupId, name, color });
      if (res.ok) {
        toast.success(t.membersPanel.guestAdded);
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(errorText(t, res.error));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserRoundPlus className="size-4" />
          {t.membersPanel.addGuest}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.membersPanel.addGuestTitle}</DialogTitle>
          <DialogDescription>
            {t.membersPanel.addGuestDescription}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="guest-name">{t.membersPanel.guestNameLabel}</Label>
            <Input
              id="guest-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder={t.membersPanel.guestNamePlaceholder}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t.membersPanel.guestColorLabel}</Label>
            <ColorSwatches value={color} onChange={setColor} disabled={pending} />
          </div>
          <Button type="submit" disabled={pending || name.trim() === ""}>
            {pending
              ? t.membersPanel.addingGuest
              : t.membersPanel.addGuestSubmit}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
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

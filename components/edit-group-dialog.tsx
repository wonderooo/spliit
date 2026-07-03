"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { updateGroup } from "@/server/actions/groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyPicker } from "@/components/currency-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useT } from "@/components/i18n-provider";
import { errorText } from "@/lib/action-result";

export function EditGroupDialog({
  groupId,
  name: initialName,
  description: initialDescription,
  baseCurrency: initialCurrency,
}: {
  groupId: string;
  name: string;
  description: string;
  baseCurrency: string;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [baseCurrency, setBaseCurrency] = useState(initialCurrency);
  const nameRef = useRef<HTMLInputElement>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateGroup({ groupId, name, description, baseCurrency });
      if (res.ok) {
        toast.success(t.editGroup.updated);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(errorText(t, res.error));
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Reset the fields to the saved values whenever the dialog reopens.
        if (o) {
          setName(initialName);
          setDescription(initialDescription);
          setBaseCurrency(initialCurrency);
        }
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
          <Pencil className="size-4" />
          {t.editGroup.edit}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          nameRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t.editGroup.title}</DialogTitle>
          <DialogDescription>{t.editGroup.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-group-name">{t.createGroup.nameLabel}</Label>
            <Input
              id="edit-group-name"
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.createGroup.namePlaceholder}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-group-desc">
              {t.createGroup.descriptionLabel}
            </Label>
            <Textarea
              id="edit-group-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.createGroup.descriptionPlaceholder}
              rows={2}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-group-currency">
              {t.createGroup.currencyLabel}
            </Label>
            <CurrencyPicker
              id="edit-group-currency"
              value={baseCurrency}
              onChange={setBaseCurrency}
            />
            <p className="text-xs text-muted-foreground">
              {t.createGroup.currencyHelp}
            </p>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? t.editGroup.saving : t.editGroup.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createGroup } from "@/server/actions/groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyPicker } from "@/components/currency-picker";
import { useT } from "@/components/i18n-provider";
import { errorText } from "@/lib/action-result";

export function CreateGroupForm() {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("USD");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createGroup({ name, description, baseCurrency });
      if (res.ok) {
        toast.success(t.createGroup.created);
        router.push(`/groups/${res.data.id}`);
        router.refresh();
      } else {
        toast.error(errorText(t, res.error));
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t.createGroup.nameLabel}</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.createGroup.namePlaceholder}
          required
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">{t.createGroup.descriptionLabel}</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t.createGroup.descriptionPlaceholder}
          rows={2}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="currency">{t.createGroup.currencyLabel}</Label>
        <CurrencyPicker
          id="currency"
          value={baseCurrency}
          onChange={setBaseCurrency}
        />
        <p className="text-xs text-muted-foreground">
          {t.createGroup.currencyHelp}
        </p>
      </div>

      <Button type="submit" disabled={pending || !name.trim()}>
        {pending ? t.createGroup.creating : t.createGroup.submit}
      </Button>
    </form>
  );
}

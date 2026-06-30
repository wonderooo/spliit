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

export function CreateGroupForm() {
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
        toast.success("Group created");
        router.push(`/groups/${res.data.id}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Group name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bali trip 2026"
          required
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Two weeks, four friends, one budget."
          rows={2}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="currency">Base currency</Label>
        <CurrencyPicker
          id="currency"
          value={baseCurrency}
          onChange={setBaseCurrency}
        />
        <p className="text-xs text-muted-foreground">
          Balances are shown in this currency. Expenses can still be added in
          any currency.
        </p>
      </div>

      <Button type="submit" disabled={pending || !name.trim()}>
        {pending ? "Creating…" : "Create group"}
      </Button>
    </form>
  );
}

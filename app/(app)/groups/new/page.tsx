import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/dictionary";
import { CreateGroupForm } from "@/components/create-group-form";
import { Card } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";

export default async function NewGroupPage() {
  await requireUser();
  const dict = await getDictionary();

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        {dict.common.back}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">
        {dict.pages.newGroup.title}
      </h1>
      <Card className="p-5">
        <CreateGroupForm />
      </Card>
    </div>
  );
}

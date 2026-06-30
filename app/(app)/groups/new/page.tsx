import Link from "next/link";
import { requireUser } from "@/lib/session";
import { CreateGroupForm } from "@/components/create-group-form";
import { Card } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";

export default async function NewGroupPage() {
  await requireUser();

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">New group</h1>
      <Card className="p-5">
        <CreateGroupForm />
      </Card>
    </div>
  );
}

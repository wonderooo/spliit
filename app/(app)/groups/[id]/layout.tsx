import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getGroup, getMembership } from "@/lib/queries";
import { GroupTabs } from "@/components/group-tabs";
import {
  EditGroupDialog,
  DeleteGroupDialog,
} from "@/components/edit-group-dialog";
import { ChevronLeft } from "lucide-react";

export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const dict = await getDictionary();

  const group = await getGroup(id);
  if (!group) notFound();

  const membership = await getMembership(id, user.id);
  if (!membership || membership.removedAt) redirect("/dashboard");

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        {dict.pages.group.allGroups}
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
          <p className="text-sm text-muted-foreground">
            {group.baseCurrency}
            {group.description ? ` · ${group.description}` : ""}
          </p>
        </div>
        {membership.role === "owner" && (
          <div className="flex shrink-0 items-center gap-2">
            <EditGroupDialog
              groupId={id}
              name={group.name}
              description={group.description ?? ""}
              baseCurrency={group.baseCurrency}
            />
            <DeleteGroupDialog groupId={id} name={group.name} />
          </div>
        )}
      </div>
      <GroupTabs groupId={id} />
      <div className="pt-1">{children}</div>
    </div>
  );
}

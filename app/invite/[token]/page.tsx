import { getSession } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/dictionary";
import { format } from "@/lib/i18n/config";
import { getInviteContext } from "@/lib/queries";
import { SignInButton } from "@/components/sign-in-button";
import { AcceptInvite } from "@/components/accept-invite";
import { Card } from "@/components/ui/card";
import { Users } from "lucide-react";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const dict = await getDictionary();
  const [session, invite] = await Promise.all([
    getSession(),
    getInviteContext(token),
  ]);

  // Unknown / revoked / expired links: a clear dead end, no join button.
  if (!invite || !invite.usable) {
    const reason = !invite
      ? dict.pages.invite.reasonInvalid
      : invite.expired
        ? dict.pages.invite.reasonExpired
        : dict.pages.invite.reasonRevoked;
    return (
      <main className="flex min-h-svh flex-col items-center justify-center px-5 py-16">
        <Card className="w-full max-w-sm items-center gap-4 p-8 text-center">
          <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Users className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">
              {dict.pages.invite.unavailableTitle}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
          </div>
        </Card>
      </main>
    );
  }

  const memberLabel =
    invite.memberCount === 1
      ? format(dict.pages.invite.memberCountOne, { count: invite.memberCount })
      : format(dict.pages.invite.memberCountMany, {
          count: invite.memberCount,
        });

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-5 py-16">
      <Card className="w-full max-w-sm items-center gap-4 p-8 text-center">
        <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Users className="size-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{invite.groupName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {format(dict.pages.invite.invitedYou, {
              name: invite.inviterName,
            })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {memberLabel} · {invite.baseCurrency}
          </p>
        </div>
        {session?.user ? (
          <AcceptInvite token={token} defaultName={session.user.name} />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <SignInButton callbackURL={`/invite/${token}`} />
            <p className="text-xs text-muted-foreground">
              {dict.auth.signInWithGoogle}
            </p>
          </div>
        )}
      </Card>
    </main>
  );
}

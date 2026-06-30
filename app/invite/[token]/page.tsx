import { getSession } from "@/lib/session";
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
  const session = await getSession();

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-5 py-16">
      <Card className="w-full max-w-sm items-center gap-4 p-8 text-center">
        <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Users className="size-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold">You&apos;re invited</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Join this group on Spliit to start splitting expenses together.
          </p>
        </div>
        {session?.user ? (
          <AcceptInvite token={token} />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <SignInButton callbackURL={`/invite/${token}`} />
            <p className="text-xs text-muted-foreground">
              Sign in with Google to accept the invite.
            </p>
          </div>
        )}
      </Card>
    </main>
  );
}

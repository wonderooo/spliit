import Link from "next/link";
import { requireUser } from "@/lib/session";
import { UserMenu } from "@/components/user-menu";
import { Logo } from "@/components/logo";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Logo />
            <span className="text-lg font-bold tracking-tight">Spliit</span>
          </Link>
          <UserMenu
            name={user.name}
            email={user.email}
            image={user.image}
          />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-5">
        {children}
      </main>
    </div>
  );
}

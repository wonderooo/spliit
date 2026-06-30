import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ShaderHero } from "@/components/shader-hero";
import { SignInButton } from "@/components/sign-in-button";
import { GradientHeading } from "@/components/ui/gradient-heading";
import TextAnimate from "@/components/ui/text-animate";
import { Users, Wallet, Globe, Scale } from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Shared groups",
    body: "Spin up a group for your trip, flat, or dinner crew and invite people with a link.",
  },
  {
    icon: Scale,
    title: "Split any way",
    body: "Equally, by exact amounts, by percentage, or by shares — the math always balances.",
  },
  {
    icon: Globe,
    title: "Multi-currency",
    body: "Log expenses in any currency. Daily rates are fetched automatically, override anytime.",
  },
  {
    icon: Wallet,
    title: "Settle up simply",
    body: "See who owes whom and the fewest payments needed to clear every debt.",
  },
];

export default async function LandingPage() {
  const session = await getSession();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="relative flex flex-col">
      {/* Hero */}
      <section className="relative flex min-h-[88svh] flex-col items-center justify-center overflow-hidden px-5 py-16 text-center">
        <ShaderHero />
        <div className="absolute inset-0 bg-black/30" aria-hidden />
        <div className="relative z-10 flex max-w-2xl flex-col items-center gap-6">
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
            ✦ Split expenses without the spreadsheet
          </span>
          <GradientHeading
            size="xxl"
            weight="black"
            variant="light"
            className="!text-white"
          >
            Spliit
          </GradientHeading>
          <TextAnimate
            text="Track group spending, split it fairly, settle up in seconds."
            type="fadeIn"
            className="text-balance text-lg font-medium text-white/90 sm:text-xl"
          />
          <div className="mt-2 flex flex-col items-center gap-3">
            <SignInButton size="lg" className="h-12 px-6 text-base shadow-xl" />
            <p className="text-xs text-white/70">
              Free to use. Sign in with Google to get started.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-5xl px-5 py-16">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border bg-card p-5 transition-colors hover:border-foreground/20"
            >
              <div className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <f.icon className="size-5" />
              </div>
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-auto border-t px-5 py-8 text-center text-sm text-muted-foreground">
        Built with Next.js, better-auth, and Drizzle. Splits your bills, not your
        friendships.
      </footer>
    </main>
  );
}

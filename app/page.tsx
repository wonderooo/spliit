import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/dictionary";
import { ShaderHero } from "@/components/shader-hero";
import { Logo } from "@/components/logo";
import { SignInButton } from "@/components/sign-in-button";
import { LanguageMenu } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { GradientHeading } from "@/components/ui/gradient-heading";
import TextAnimate from "@/components/ui/text-animate";
import {
  Users,
  Wallet,
  Globe,
  Scale,
  ScanLine,
  Sparkles,
  ShieldCheck,
  Check,
  Share,
  SquarePlus,
  Smartphone,
} from "lucide-react";

const featureIcons = [Scale, Globe, Wallet, Users];
const installIcons = [Share, SquarePlus, Check];

export default async function LandingPage() {
  const session = await getSession();
  if (session?.user) redirect("/dashboard");

  const dict = await getDictionary();
  const t = dict.home;

  return (
    <main className="relative flex flex-col">
      {/* Hero */}
      <section className="relative flex min-h-[90svh] flex-col items-center justify-center overflow-hidden px-5 py-16 text-center">
        <ShaderHero />
        <div className="absolute inset-0 bg-black/30" aria-hidden />
        <div className="absolute right-3 top-3 z-20 flex items-center gap-1 text-white [&_button]:text-white/90 [&_button:hover]:text-white">
          <LanguageMenu />
          <ThemeToggle />
        </div>
        <div className="relative z-10 flex max-w-2xl flex-col items-center gap-6">
          <Logo className="size-16 rounded-2xl shadow-xl ring-white/20" />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
            <Sparkles className="size-3.5" />
            {t.badge}
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
            text={t.tagline}
            type="fadeIn"
            className="text-balance text-lg font-medium text-white/90 sm:text-xl"
          />
          <div className="mt-2 flex flex-col items-center gap-3">
            <SignInButton size="lg" className="h-12 px-6 text-base shadow-xl" />
            <p className="text-xs text-white/70">{t.ctaNote}</p>
          </div>
        </div>
      </section>

      {/* Receipt scanning - the headline feature */}
      <section className="border-t bg-background px-5 py-20 sm:py-24">
        <div className="mx-auto grid w-full max-w-5xl items-center gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <ScanLine className="size-3.5" />
              {t.receipt.label}
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t.receipt.title}
            </h2>
            <p className="text-pretty text-muted-foreground">{t.receipt.body}</p>
            <ul className="flex flex-col gap-2.5 text-sm">
              {t.receipt.points.map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Receipt visual */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-violet-500/20 via-fuchsia-500/20 to-blue-500/20 blur-2xl" />
            <div className="rounded-2xl border bg-card p-5 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm font-semibold">
                    EL CHIRINGUITO
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    Barcelona · 28 Jun
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 px-2 py-1 text-[11px] font-semibold text-white">
                  <Sparkles className="size-3" />
                  {t.receipt.scanned}
                </span>
              </div>
              <div className="border-t border-dashed pt-3 font-mono text-sm">
                {[
                  ["Paella ×2", "38.00"],
                  ["Sangría ×3", "21.00"],
                  ["Pan con tomate", "6.50"],
                  ["Grilled fish", "24.50"],
                ].map(([item, price]) => (
                  <div
                    key={item}
                    className="flex justify-between py-1 text-muted-foreground"
                  >
                    <span>{item}</span>
                    <span className="tabular-nums">{price}</span>
                  </div>
                ))}
                <div className="mt-2 flex justify-between border-t border-dashed pt-2 font-semibold">
                  <span>{t.receipt.total}</span>
                  <span className="tabular-nums">€90.00</span>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-muted/50 p-3 text-sm">
                <span className="text-muted-foreground">
                  {t.receipt.splitWays}
                </span>
                <span className="font-semibold tabular-nums">
                  {t.receipt.each}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="border-t bg-background px-5 py-20 sm:py-24">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mx-auto mb-12 max-w-xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t.features.title}
            </h2>
            <p className="mt-3 text-muted-foreground">{t.features.subtitle}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {t.features.items.map((f, i) => {
              const Icon = featureIcons[i];
              return (
                <div
                  key={f.title}
                  className="rounded-2xl border bg-card p-6 transition-colors hover:border-foreground/20"
                >
                  <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="text-lg font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {f.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t bg-background px-5 py-20 sm:py-24">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mx-auto mb-12 max-w-xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t.steps.title}
            </h2>
          </div>
          <ol className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {t.steps.items.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-3">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-blue-500 font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Install on iPhone (PWA) */}
      <section className="border-t bg-background px-5 py-20 sm:py-24">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mx-auto mb-12 max-w-xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Smartphone className="size-3.5" />
              {t.install.label}
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              {t.install.title}
            </h2>
            <p className="mt-3 text-muted-foreground">{t.install.body}</p>
          </div>
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {t.install.items.map((s, i) => {
              const Icon = installIcons[i];
              return (
                <li
                  key={s.title}
                  className="relative flex flex-col gap-3 rounded-2xl border bg-card p-6"
                >
                  <span className="absolute right-5 top-5 text-sm font-semibold text-muted-foreground/50">
                    {i + 1}
                  </span>
                  <div className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="text-base font-semibold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                </li>
              );
            })}
          </ol>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            {t.install.android}
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t bg-background px-5 py-20 sm:py-24">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 text-center">
          <Logo className="size-12 rounded-xl" />
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t.finalCta.title}
          </h2>
          <p className="text-muted-foreground">{t.finalCta.body}</p>
          <SignInButton size="lg" className="h-12 px-6 text-base" />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            {t.finalCta.note}
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-background px-5 py-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-2">
            <Logo className="size-7 rounded-lg" />
            <span className="font-bold tracking-tight">Spliit</span>
          </div>
          <p className="text-sm text-muted-foreground">{t.footer.tagline}</p>
          <p className="text-xs text-muted-foreground">{t.footer.copyright}</p>
        </div>
      </footer>
    </main>
  );
}

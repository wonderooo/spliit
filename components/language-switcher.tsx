"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { setLocale } from "@/server/actions/locale";
import { locales, localeNames } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Shared switching logic: persist the cookie, then refresh to re-render in the new locale. */
function useLanguageSwitch() {
  const router = useRouter();
  const { locale } = useI18n();
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return { locale, change };
}

/** Language picker as a sub-menu, for nesting inside an existing DropdownMenu (avatar menu). */
export function LanguageMenuSub() {
  const { dict } = useI18n();
  const { locale, change } = useLanguageSwitch();

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Languages className="size-4" />
        {dict.common.language}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value={locale} onValueChange={change}>
          {locales.map((l) => (
            <DropdownMenuRadioItem key={l} value={l}>
              {localeNames[l]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/** Standalone language picker (globe button) for surfaces without an avatar menu (landing). */
export function LanguageMenu() {
  const { dict } = useI18n();
  const { locale, change } = useLanguageSwitch();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={dict.common.language}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "text-muted-foreground",
        )}
      >
        <Languages className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={locale} onValueChange={change}>
          {locales.map((l) => (
            <DropdownMenuRadioItem key={l} value={l}>
              {localeNames[l]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

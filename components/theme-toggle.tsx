"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";

/** Standalone dark/light toggle for surfaces without an avatar menu (landing page). */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { dict } = useI18n();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={dict.common.toggleTheme}
      className="text-muted-foreground"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {/* Icon chosen via CSS class to avoid a hydration flash before theme resolves. */}
      <Sun className="hidden size-4 dark:block" />
      <Moon className="block size-4 dark:hidden" />
    </Button>
  );
}

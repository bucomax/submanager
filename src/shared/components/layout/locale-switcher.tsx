"use client";

import { routing } from "@/i18n/routing";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { BrazilFlag, UsaFlag } from "@/shared/utils/flags";
import { usePersistedAppStore } from "@/shared/stores/use-persisted-app-store";
import type { LocalePreference } from "@/shared/types/persisted-app";
import { useLocale, useTranslations } from "next-intl";

function LocaleFlagIcon({ locale }: { locale: string }) {
  const Flag = locale === "pt-BR" ? BrazilFlag : UsaFlag;
  return (
    <span className="inline-flex shrink-0" aria-hidden>
      <Flag className="size-4 shrink-0" />
    </span>
  );
}

type LocaleSwitcherProps = {
  variant?: "toolbar" | "floating";
};

export function LocaleSwitcher({ variant = "toolbar" }: LocaleSwitcherProps) {
  const locale = useLocale();
  const setLocalePreference = usePersistedAppStore((s) => s.setLocalePreference);
  const t = useTranslations("global.locale");

  function localeLabel(loc: string) {
    return loc === "pt-BR" ? t("ptBR") : t("en");
  }

  function switchLocale(loc: string) {
    if (loc === locale) return;
    setLocalePreference(loc as LocalePreference);
  }

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={variant === "floating" ? "outline" : "ghost"}
            size={variant === "floating" ? "icon" : "icon-sm"}
            aria-label={t("ariaLabel")}
            className={cn(
              "shrink-0 gap-0 p-0",
              variant === "floating" &&
                "h-9 w-9 rounded-full border border-border bg-transparent shadow-sm [&_svg]:pointer-events-none",
              variant === "toolbar" && "size-9 rounded-lg",
            )}
          >
            <LocaleFlagIcon locale={locale} />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        {routing.locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => switchLocale(loc)}
            data-active={locale === loc ? "" : undefined}
            className={cn("flex items-center gap-2.5", locale === loc ? "bg-muted" : undefined)}
          >
            <LocaleFlagIcon locale={loc} />
            <span>{localeLabel(loc)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (variant === "floating") {
    return (
      <div className="pointer-events-auto fixed top-4 right-4 z-50" role="navigation" aria-label={t("ariaLabel")}>
        {menu}
      </div>
    );
  }

  return menu;
}

import { LocaleSwitcher } from "@/shared/components/layout/locale-switcher";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type AuthLayoutProps = {
  children: ReactNode;
  /**
   * `wide` — formulários com várias colunas (ex.: auto-cadastro público).
   * `default` — login / convites (~max-w-md).
   */
  variant?: "default" | "wide";
};

/**
 * Layout compartilhado das rotas públicas de autenticação (`(auth)`):
 * fundo com gradiente leve, troca de idioma fixa no canto, coluna central.
 */
export function AuthLayout({ children, variant = "default" }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-gradient-to-b from-muted/50 via-background to-background dark:via-background">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-25"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(ellipse 120% 80% at 50% -30%, oklch(0.55 0.12 250 / 0.18), transparent 55%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.12]"
        aria-hidden
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='1' cy='1' r='1' fill='currentColor'/%3E%3C/svg%3E")`,
        }}
      />
      <LocaleSwitcher variant="floating" />
      <main
        className={cn(
          "relative z-0 mx-auto flex w-full flex-1 flex-col justify-center px-4 py-16 sm:px-6",
          variant === "wide"
            ? "max-w-lg sm:max-w-xl md:max-w-2xl lg:max-w-4xl xl:max-w-5xl"
            : "max-w-md",
        )}
      >
        {children}
      </main>
    </div>
  );
}

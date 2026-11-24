import { Link } from "@/i18n/navigation";
import { BrandMark } from "@/shared/components/brand/brand-mark";
import { LocaleSwitcher } from "@/shared/components/layout/locale-switcher";
import { cn } from "@/lib/utils";
import { Clock, GitBranch, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

type AuthLayoutProps = {
  children: ReactNode;
  /**
   * `wide` — formulários com várias colunas (ex.: auto-cadastro público).
   * `default` — login / convites (~max-w-md), com o painel da marca à direita em telas largas.
   */
  variant?: "default" | "wide";
};

const brandItems = [
  { icon: GitBranch, title: "pathwaysTitle", body: "pathwaysBody" },
  { icon: Clock, title: "slaTitle", body: "slaBody" },
  { icon: UserRound, title: "portalTitle", body: "portalBody" },
] as const;

/**
 * Layout compartilhado das rotas públicas de autenticação (`(auth)`), no visual do kit:
 * coluna do formulário sobre o fundo pedra e, no `default`, painel escuro da marca à direita (lg+).
 */
export function AuthLayout({ children, variant = "default" }: AuthLayoutProps) {
  const tBrand = useTranslations("global");
  const t = useTranslations("auth.brandPanel");

  return (
    <div className="bg-background relative flex min-h-dvh">
      <div className="relative flex min-w-0 flex-1 flex-col px-4 py-8 sm:px-10">
        <div className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="text-foreground flex w-fit items-center gap-2.5 rounded-lg text-[19px] font-extrabold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandMark className="size-10" />
          {tBrand("brand")}
        </Link>
        <LocaleSwitcher />
        </div>
        <main
          className={cn(
            "animate-enter relative z-0 mx-auto flex w-full flex-1 flex-col justify-center py-12",
            variant === "wide"
              ? "max-w-lg sm:max-w-xl md:max-w-2xl lg:max-w-4xl xl:max-w-5xl"
              : "max-w-[25rem]",
          )}
        >
          {children}
        </main>
      </div>
      {variant === "default" ? (
        <aside className="relative m-4 hidden w-[44%] max-w-[640px] flex-col justify-between gap-8 overflow-hidden rounded-[28px] bg-[#0e1d29] p-12 text-[#c8d4db] lg:flex">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(rgb(142 195 219 / 0.18) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          <BrandMark tone="dark" className="relative size-14" title={t("eyebrow")} />
          <div className="relative flex flex-col gap-6">
            <p className="max-w-[14ch] text-4xl leading-[1.05] font-extrabold tracking-[-0.035em] text-[#edf3f6] xl:text-[40px]">
              {t("title")}
            </p>
            <ul className="flex max-w-md flex-col gap-2.5">
              {brandItems.map(({ icon: Icon, title, body }) => (
                <li
                  key={title}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-sm"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[#8ec3db]/15 text-[#8ec3db]">
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <span>
                    <strong className="block font-semibold text-[#edf3f6]">{t(title)}</strong>
                    {t(body)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <span className="relative text-sm text-[#93a4af]">{tBrand("meta.description")}</span>
        </aside>
      ) : null}
    </div>
  );
}

"use client";

import type { PatientSelfRegisterFormValues } from "@/features/clients/app/utils/schemas";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ExternalLink, FileText, ScrollText, Shield } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Controller, useFormContext } from "react-hook-form";

type ConsentCheckboxCardProps = {
  name: "acceptTerms" | "acceptPrivacy";
  inputId: string;
  icon: ReactNode;
  title: string;
  description: ReactNode;
};

function ConsentCheckboxCard({ name, inputId, icon, title, description }: ConsentCheckboxCardProps) {
  const t = useTranslations("clients");
  const form = useFormContext<PatientSelfRegisterFormValues>();

  return (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => (
        <div
          className={cn(
            "group rounded-xl border bg-card/90 p-4 shadow-sm transition-[border-color,box-shadow] sm:p-5",
            fieldState.error
              ? "border-destructive/55 ring-2 ring-destructive/20"
              : "border-border/90 hover:border-primary/30 focus-within:border-primary/45 focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]",
          )}
        >
          <label htmlFor={inputId} className="flex cursor-pointer gap-3.5 sm:gap-4">
            <input
              id={inputId}
              name={name}
              type="checkbox"
              checked={field.value}
              onChange={(e) => field.onChange(e.target.checked)}
              className="border-input text-primary focus-visible:ring-ring mt-1 size-[1.125rem] shrink-0 cursor-pointer rounded border-2 accent-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            />
            <span className="min-w-0 flex-1 space-y-2.5">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-foreground inline-flex items-center gap-2 text-sm font-semibold">
                  {icon}
                  {title}
                </span>
                <span className="bg-muted text-muted-foreground rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  {t("selfRegister.consent.requiredShort")}
                </span>
              </span>
              <span className="text-muted-foreground block text-sm leading-relaxed">{description}</span>
              {fieldState.error?.message ? (
                <span className="text-destructive block text-sm font-medium" role="alert">
                  {fieldState.error.message}
                </span>
              ) : null}
            </span>
          </label>
        </div>
      )}
    />
  );
}

function LegalDocumentLink({ href, children }: { href: string; children: ReactNode }) {
  const t = useTranslations("clients");
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={t("selfRegister.consent.openDocumentHint")}
      className="text-primary inline-flex items-center gap-1.5 font-medium underline decoration-primary/35 underline-offset-[3px] transition-colors hover:decoration-primary"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
      <ExternalLink className="text-primary/80 size-3.5 shrink-0" aria-hidden />
    </Link>
  );
}

/** Aceite obrigatório de Termos de Uso e Política de Privacidade. */
export function SelfRegisterConsentSection() {
  const t = useTranslations("clients");

  return (
    <div className="space-y-4">
      <div className="flex gap-3.5 rounded-xl border border-border/80 bg-gradient-to-br from-muted/45 via-background to-muted/30 p-4 shadow-sm ring-1 ring-black/[0.03] dark:from-muted/25 dark:via-background dark:to-muted/15 dark:ring-white/[0.04] sm:p-5">
        <div className="bg-primary/12 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
          <ScrollText className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <h3 className="text-foreground text-base font-semibold leading-snug tracking-tight">
            {t("selfRegister.consent.sectionTitle")}
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">{t("selfRegister.consent.sectionDescription")}</p>
        </div>
      </div>
      <div className="space-y-3">
        <ConsentCheckboxCard
          name="acceptTerms"
          inputId="patient-self-register-accept-terms"
          icon={<FileText className="text-primary size-4 shrink-0" aria-hidden />}
          title={t("selfRegister.consent.termsShortTitle")}
          description={t.rich("selfRegister.consent.termsRich", {
            terms: (chunks) => <LegalDocumentLink href="/legal/terms">{chunks}</LegalDocumentLink>,
          })}
        />
        <ConsentCheckboxCard
          name="acceptPrivacy"
          inputId="patient-self-register-accept-privacy"
          icon={<Shield className="text-primary size-4 shrink-0" aria-hidden />}
          title={t("selfRegister.consent.privacyShortTitle")}
          description={t.rich("selfRegister.consent.privacyRich", {
            privacy: (chunks) => <LegalDocumentLink href="/legal/privacy">{chunks}</LegalDocumentLink>,
          })}
        />
      </div>
    </div>
  );
}

"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  getPortalPasswordRuleChecks,
  isPortalPasswordStrong,
  type PortalPasswordRuleChecks,
} from "@/lib/validators/patient-portal-auth";
import { cn } from "@/lib/utils";

export type PasswordStrengthLabelsNamespace =
  | "clients.selfRegister.passwordStrength"
  | "patientPortal.passwordStrength";

type PasswordStrengthIndicatorProps = {
  password: string;
  confirmPassword: string;
  className?: string;
  /** Traduções dos critérios (default: auto-cadastro). */
  labelsNamespace?: PasswordStrengthLabelsNamespace;
  /** Em telas ≥ sm, lista os 5 primeiros critérios em duas colunas (modais / formulários largos). */
  rulesTwoColumn?: boolean;
};

function RuleRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok ? (
        <Check className="size-4 shrink-0 text-success" aria-hidden />
      ) : (
        <X className="text-destructive/80 size-4 shrink-0" aria-hidden />
      )}
      <span
        className={cn(
          ok ? "text-success" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </li>
  );
}

export function PasswordStrengthIndicator({
  password,
  confirmPassword,
  className,
  labelsNamespace = "clients.selfRegister.passwordStrength",
  rulesTwoColumn = false,
}: PasswordStrengthIndicatorProps) {
  const t = useTranslations(labelsNamespace);
  const checks: PortalPasswordRuleChecks = getPortalPasswordRuleChecks(password);
  const strong = isPortalPasswordStrong(checks);
  const match = strong && password.length > 0 && password === confirmPassword;

  return (
    <div className={cn("space-y-3", className)}>
      <ul
        className={cn(
          rulesTwoColumn
            ? "grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2"
            : "space-y-1.5",
        )}
        aria-live="polite"
      >
        <RuleRow ok={checks.minLength} label={t("minLength")} />
        <RuleRow ok={checks.uppercase} label={t("uppercase")} />
        <RuleRow ok={checks.lowercase} label={t("lowercase")} />
        <RuleRow ok={checks.digit} label={t("digit")} />
        <RuleRow ok={checks.special} label={t("special")} />
        <RuleRow ok={match} label={t("match")} />
      </ul>
    </div>
  );
}

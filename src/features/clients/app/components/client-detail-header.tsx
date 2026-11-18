"use client";

import { ClientDetailCardTitle } from "@/features/clients/app/components/client-detail-card-title";
import { PatientPortalAccessDialog } from "@/features/clients/app/components/patient-portal-access-dialog";
import { PatientSelfRegisterQrDialog } from "@/features/clients/app/components/patient-self-register-qr-dialog";
import { useClientPortalLinkActions } from "@/features/clients/app/hooks/use-client-portal-link-actions";
import { Link } from "@/i18n/navigation";
import { waDigits } from "@/lib/utils/phone";
import { formatCpfDisplay } from "@/lib/validators/cpf";
import { formatPhoneBrDisplay } from "@/lib/validators/phone";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { InfoTooltip } from "@/shared/components/ui/info-tooltip";
import type { ClientDetailClientDto } from "@/types/api/clients-v1";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  LayoutDashboard,
  Loader2,
  Mail,
  Phone,
  UserPlus,
  UserRound,
} from "lucide-react";
import { useTranslations } from "next-intl";

/** Cabeçalho da ficha: identidade, ações do portal do paciente e auto-cadastro. */
export function ClientDetailHeader({ client }: { client: ClientDetailClientDto }) {
  const t = useTranslations("clients.detail");
  const { busy: portalLinkBusy, sendPortalLink } = useClientPortalLinkActions(client);
  const digits = waDigits(client.phone);

  return (
    <header className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:items-start">
        <Card className="border-border min-w-0 gap-2">
          <CardHeader className="pb-0">
            <div className="flex items-start justify-between gap-2">
              <ClientDetailCardTitle icon={UserRound} className="min-w-0 flex-1">
                {t("identitySection.title")}
              </ClientDetailCardTitle>
              <InfoTooltip ariaLabel={t("identitySection.infoAria")}>{t("identitySection.hint")}</InfoTooltip>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xl font-semibold tracking-tight">{client.name}</p>
              {client.isMinor ? (
                <Badge variant="secondary" className="text-xs font-medium">
                  {t("minorBadge")}
                </Badge>
              ) : null}
            </div>
            <ul className="text-muted-foreground flex flex-col gap-2.5 text-sm">
              {client.phone?.trim() ? (
                <li className="bg-surface flex min-w-0 items-center gap-3 rounded-xl px-3 py-2">
                  <span className="bg-accent text-accent-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-lg">
                    <Phone className="size-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 tabular-nums">{formatPhoneBrDisplay(client.phone)}</span>
                </li>
              ) : null}
              {client.email?.trim() ? (
                <li className="bg-surface flex min-w-0 items-center gap-3 rounded-xl px-3 py-2">
                  <span className="bg-accent text-accent-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-lg">
                    <Mail className="size-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 truncate" title={client.email}>
                    {client.email}
                  </span>
                </li>
              ) : null}
              {client.documentId ? (
                <li className="bg-surface flex min-w-0 items-center gap-3 rounded-xl px-3 py-2">
                  <span className="bg-accent text-accent-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold tracking-wide">
                    {t("cpf")}
                  </span>
                  <span className="min-w-0 tabular-nums">{formatCpfDisplay(client.documentId)}</span>
                </li>
              ) : null}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border min-w-0 gap-2">
          <CardHeader className="pb-0">
            <div className="flex items-start justify-between gap-2">
              <ClientDetailCardTitle icon={LayoutDashboard} className="min-w-0 flex-1">
                {t("portalSection.title")}
              </ClientDetailCardTitle>
              <InfoTooltip ariaLabel={t("portalSection.infoAria")}>
                {t("portalSection.description")}
              </InfoTooltip>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pt-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-full justify-start gap-2 bg-background/80 px-3 font-normal"
              disabled={portalLinkBusy !== null || !client.email?.trim()}
              title={!client.email?.trim() ? t("portalLink.emailRequired") : undefined}
              onClick={() => void sendPortalLink("email")}
            >
              {portalLinkBusy === "email" ? (
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Mail className="size-4 shrink-0" aria-hidden />
              )}
              <span className="min-w-0 truncate text-left">{t("portalLink.sendEmail")}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-full justify-start gap-2 bg-background/80 px-3 font-normal"
              disabled={portalLinkBusy !== null}
              onClick={() => void sendPortalLink("copy")}
            >
              {portalLinkBusy === "copy" ? (
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Copy className="size-4 shrink-0" aria-hidden />
              )}
              <span className="min-w-0 truncate text-left">{t("portalLink.copyLink")}</span>
            </Button>
            <PatientPortalAccessDialog
              clientId={client.id}
              triggerLabel={t("portalAccessDialog.trigger")}
              triggerClassName="h-9 w-full justify-start gap-2 bg-background/80 px-3 font-normal"
            />
          </CardContent>
        </Card>

        <Card className="border-border min-w-0 gap-2 md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-0">
            <div className="flex items-start justify-between gap-2">
              <ClientDetailCardTitle icon={UserPlus} className="min-w-0 flex-1">
                {t("selfRegisterSection.title")}
              </ClientDetailCardTitle>
              <InfoTooltip ariaLabel={t("selfRegisterSection.infoAria")}>
                {t("selfRegisterSection.description")}
              </InfoTooltip>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pt-0">
            <PatientSelfRegisterQrDialog
              clientId={client.id}
              triggerLabel={t("selfRegisterLinkThisPatient")}
              triggerClassName="h-9 w-full justify-start gap-2 bg-background/80 px-3 font-normal"
            />
            {digits ? (
              <Button
                nativeButton={false}
                variant="outline"
                size="sm"
                className="h-9 w-full justify-start gap-2 bg-background/80 px-3 font-normal"
                render={<a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" />}
              >
                <ExternalLink className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 truncate text-left">{t("whatsapp")}</span>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end pt-1">
        <Button
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="text-muted-foreground -mx-1"
          render={<Link href="/dashboard/clients" />}
        >
          <ArrowLeft className="size-4" />
          {t("backToList")}
        </Button>
      </div>
    </header>
  );
}

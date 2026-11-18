"use client";

import { PatientSelfRegisterQrDialog } from "@/features/clients/app/components/patient-self-register-qr-dialog";
import { ClientDetailCardTitle } from "@/features/clients/app/components/client-detail-card-title";
import { Link } from "@/i18n/navigation";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { InfoTooltip } from "@/shared/components/ui/info-tooltip";
import { QrCode, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Dois boxes: cadastro público (QR/link) e cadastro pela equipe. Textos extras no tooltip (i).
 */
export function ClientsListPageToolbar() {
  const t = useTranslations("clients.list");

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
      <Card className="border-border min-w-0 gap-2">
        <CardHeader className="pb-0">
          <div className="flex items-start justify-between gap-2">
            <ClientDetailCardTitle icon={QrCode} className="min-w-0 flex-1">
              {t("invitePublic.title")}
            </ClientDetailCardTitle>
            <InfoTooltip ariaLabel={t("invitePublic.infoAria")}>{t("invitePublic.hint")}</InfoTooltip>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <PatientSelfRegisterQrDialog
            triggerLabel={t("invitePublic.button")}
            triggerClassName="h-9 w-full justify-start gap-2 bg-background/80 px-3 font-normal"
          />
        </CardContent>
      </Card>

      <Card className="border-border min-w-0 gap-2">
        <CardHeader className="pb-0">
          <div className="flex items-start justify-between gap-2">
            <ClientDetailCardTitle icon={UserPlus} className="min-w-0 flex-1">
              {t("newPatientSection.title")}
            </ClientDetailCardTitle>
            <InfoTooltip ariaLabel={t("newPatientSection.infoAria")}>
              {t("newPatientSection.hint")}
            </InfoTooltip>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Button
            nativeButton={false}
            size="sm"
            className="h-9 w-full justify-start gap-2 px-3 font-normal"
            render={<Link href="/dashboard/clients/new" />}
          >
            <UserPlus className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 truncate text-left">{t("newPatient")}</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

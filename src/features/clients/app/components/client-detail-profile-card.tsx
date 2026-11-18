"use client";

import { ClientDetailCardTitle } from "@/features/clients/app/components/client-detail-card-title";
import { ClientProfileAddressSection } from "@/features/clients/app/components/client-profile-address-section";
import { ClientProfileAssignmentSection } from "@/features/clients/app/components/client-profile-assignment-section";
import {
  ClientProfileContactSection,
  ClientProfileStaffBasicsSection,
} from "@/features/clients/app/components/client-profile-contact-section";
import { ClientProfileGuardianSection } from "@/features/clients/app/components/client-profile-guardian-section";
import { useClientProfileForm } from "@/features/clients/app/hooks/use-client-profile-form";
import type { ClientDetailClientDto } from "@/types/api/clients-v1";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/shared/components/ui/card";
import { Loader2, Save, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";

type ClientDetailProfileCardProps = {
  clientId: string;
  client: ClientDetailClientDto;
  variant?: "staff" | "patient";
  /** Obrigatório quando `variant` é `patient`. */
  tenantSlug?: string;
};

export function ClientDetailProfileCard({
  clientId,
  client,
  variant = "staff",
  tenantSlug,
}: ClientDetailProfileCardProps) {
  const isPatient = variant === "patient";
  const t = useTranslations("clients.detail.profile");
  const { draft, setField, dirty, saving, saveProfile } = useClientProfileForm({
    clientId,
    client,
    isPatient,
    tenantSlug,
  });
  const sectionProps = { client, draft, setField, saving, isPatient };

  return (
    <Card className="min-w-0">
      <CardHeader>
        <ClientDetailCardTitle icon={UserRound}>{isPatient ? t("patientTitle") : t("title")}</ClientDetailCardTitle>
        <CardDescription>{isPatient ? t("patientDescription") : t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="w-full min-w-0 space-y-4">
        <ClientProfileContactSection {...sectionProps} />
        <ClientProfileStaffBasicsSection {...sectionProps} />
        <ClientProfileGuardianSection {...sectionProps} />
        <ClientProfileAddressSection draft={draft} setField={setField} saving={saving} />
        {isPatient ? null : (
          <ClientProfileAssignmentSection draft={draft} setField={setField} saving={saving} />
        )}
        <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void saveProfile()}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {saving ? t("saving") : t("save")}
        </Button>
      </CardContent>
    </Card>
  );
}

"use client";

import { REL_NONE } from "@/features/clients/app/utils/client-profile-form";
import type { ClientProfileSectionProps } from "@/features/clients/app/types/client-profile";
import { digitsOnlyCpf, formatCpfDisplay } from "@/lib/validators/cpf";
import { digitsOnlyPhone, formatPhoneBrDisplay } from "@/lib/validators/phone";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { GuardianRelationship } from "@prisma/client";
import { useTranslations } from "next-intl";

/** Responsável legal (editável pela equipe, somente leitura para o paciente) e contato de emergência. */
export function ClientProfileGuardianSection({
  client,
  draft,
  setField,
  saving,
  isPatient,
}: ClientProfileSectionProps) {
  const t = useTranslations("clients.detail.profile");
  const showGuardianReadonly =
    isPatient && (client.guardianName || client.guardianDocumentId || client.guardianPhone);

  return (
    <>
    {!isPatient && draft.isMinor ? (
      <div className="bg-muted/40 space-y-3 rounded-lg border p-4">
        <p className="text-sm font-medium">{t("guardianSection")}</p>
        <Field>
          <FieldLabel htmlFor="guardian-name">{t("guardianName")}</FieldLabel>
          <Input
            id="guardian-name"
            value={draft.guardianName}
            onChange={(e) => setField("guardianName", e.target.value)}
            disabled={saving}
            className="w-full min-w-0"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="guardian-cpf">{t("guardianDocumentId")}</FieldLabel>
          <Input
            id="guardian-cpf"
            inputMode="numeric"
            value={formatCpfDisplay(draft.guardianDocumentDigits)}
            onChange={(e) => setField("guardianDocumentDigits", digitsOnlyCpf(e.target.value))}
            disabled={saving}
            className="w-full min-w-0 tabular-nums"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="guardian-phone">{t("guardianPhone")}</FieldLabel>
          <Input
            id="guardian-phone"
            type="tel"
            inputMode="tel"
            value={formatPhoneBrDisplay(draft.guardianPhoneDigits)}
            onChange={(e) => setField("guardianPhoneDigits", digitsOnlyPhone(e.target.value))}
            disabled={saving}
            className="w-full min-w-0 tabular-nums"
          />
        </Field>
        <Field>
          <FieldLabel>{t("guardianRelationshipLabel")}</FieldLabel>
          <Select
            value={draft.guardianRelationship}
            onValueChange={(v) => setField("guardianRelationship", v ?? REL_NONE)}
            disabled={saving}
          >
            <SelectTrigger className="w-full min-w-0">
              <SelectValue placeholder={t("guardianRelationshipLabel")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={REL_NONE}>{t("guardianRelationshipPlaceholder")}</SelectItem>
              <SelectItem value={GuardianRelationship.mother}>
                {t("guardianRelationship.mother")}
              </SelectItem>
              <SelectItem value={GuardianRelationship.father}>
                {t("guardianRelationship.father")}
              </SelectItem>
              <SelectItem value={GuardianRelationship.legal_guardian}>
                {t("guardianRelationship.legal_guardian")}
              </SelectItem>
              <SelectItem value={GuardianRelationship.other}>
                {t("guardianRelationship.other")}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="guardian-email">{t("guardianEmail")}</FieldLabel>
          <Input
            id="guardian-email"
            type="email"
            autoComplete="email"
            value={draft.guardianEmail}
            onChange={(e) => setField("guardianEmail", e.target.value)}
            disabled={saving}
            className="w-full min-w-0"
          />
        </Field>
      </div>
    ) : null}

    {!isPatient ? (
      <div className="bg-muted/40 space-y-3 rounded-lg border p-4">
        <p className="text-sm font-medium">{t("emergencySection")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="emergency-name">{t("emergencyContactName")}</FieldLabel>
            <Input
              id="emergency-name"
              value={draft.emergencyName}
              onChange={(e) => setField("emergencyName", e.target.value)}
              disabled={saving}
              className="w-full min-w-0"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="emergency-phone">{t("emergencyContactPhone")}</FieldLabel>
            <Input
              id="emergency-phone"
              type="tel"
              inputMode="tel"
              value={formatPhoneBrDisplay(draft.emergencyPhoneDigits)}
              onChange={(e) => setField("emergencyPhoneDigits", digitsOnlyPhone(e.target.value))}
              disabled={saving}
              className="w-full min-w-0 tabular-nums"
            />
          </Field>
        </div>
      </div>
    ) : null}

    {showGuardianReadonly ? (
      <div className="bg-muted/35 space-y-2 rounded-lg border p-4 text-sm">
        <p className="font-medium">{t("guardianSectionReadonly")}</p>
        <p>
          <span className="text-muted-foreground">{t("guardianName")}: </span>
          {client.guardianName ?? "—"}
        </p>
        <p>
          <span className="text-muted-foreground">{t("guardianDocumentId")}: </span>
          {client.guardianDocumentId ? formatCpfDisplay(client.guardianDocumentId) : "—"}
        </p>
        <p>
          <span className="text-muted-foreground">{t("guardianPhone")}: </span>
          {client.guardianPhone ? formatPhoneBrDisplay(client.guardianPhone) : "—"}
        </p>
        {client.guardianEmail?.trim() ? (
          <p>
            <span className="text-muted-foreground">{t("guardianEmail")}: </span>
            {client.guardianEmail}
          </p>
        ) : null}
        {client.guardianRelationship ? (
          <p>
            <span className="text-muted-foreground">{t("guardianRelationshipLabel")}: </span>
            {client.guardianRelationship === GuardianRelationship.mother
              ? t("guardianRelationship.mother")
              : client.guardianRelationship === GuardianRelationship.father
                ? t("guardianRelationship.father")
                : client.guardianRelationship === GuardianRelationship.legal_guardian
                  ? t("guardianRelationship.legal_guardian")
                  : t("guardianRelationship.other")}
          </p>
        ) : null}
      </div>
    ) : null}
    </>
  );
}

"use client";

import type { ClientProfileSectionProps } from "@/features/clients/app/types/client-profile";
import { REL_NONE } from "@/features/clients/app/utils/client-profile-form";
import { todayIsoDateLocal } from "@/lib/utils/date";
import { digitsOnlyCpf, formatCpfDisplay } from "@/lib/validators/cpf";
import { digitsOnlyPhone, formatPhoneBrDisplay } from "@/lib/validators/phone";
import { Field, FieldDescription, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { PatientPreferredChannel } from "@prisma/client";
import { useTranslations } from "next-intl";

/** Identidade e contato: nome/telefone (paciente), e-mail, telefone (equipe) e CPF. */
export function ClientProfileContactSection({
  client,
  draft,
  setField,
  saving,
  isPatient,
}: ClientProfileSectionProps) {
  const t = useTranslations("clients.detail.profile");
  return (
    <>
    {isPatient ? (
      <>
        <Field>
          <FieldLabel htmlFor="client-profile-name">{t("name")}</FieldLabel>
          <Input
            id="client-profile-name"
            autoComplete="name"
            value={draft.name}
            onChange={(e) => setField("name", e.target.value)}
            disabled={saving}
            className="w-full min-w-0"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="client-profile-phone">
            {client.isMinor ? t("phoneMinor") : t("phone")}
          </FieldLabel>
          <FieldDescription>
            {client.isMinor ? t("phoneMinorHint") : t("phoneHint")}
          </FieldDescription>
          <Input
            id="client-profile-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={formatPhoneBrDisplay(draft.phoneDigits)}
            onChange={(e) => setField("phoneDigits", digitsOnlyPhone(e.target.value))}
            disabled={saving}
            className="w-full min-w-0 tabular-nums"
          />
        </Field>
      </>
    ) : null}
    <Field>
      <FieldLabel htmlFor="client-profile-email">
        {(isPatient ? client.isMinor : draft.isMinor) ? t("emailMinor") : t("email")}
      </FieldLabel>
      {(isPatient ? client.isMinor : draft.isMinor) ? (
        <FieldDescription>{t("emailMinorHint")}</FieldDescription>
      ) : null}
      <Input
        id="client-profile-email"
        type="email"
        autoComplete="email"
        value={draft.email}
        onChange={(e) => setField("email", e.target.value)}
        disabled={saving}
        className="w-full min-w-0"
      />
    </Field>
    {!isPatient ? (
      <Field>
        <FieldLabel htmlFor="client-profile-phone-staff">
          {draft.isMinor ? t("phoneMinor") : t("phone")}
        </FieldLabel>
        <FieldDescription>
          {draft.isMinor ? t("phoneMinorHint") : t("phoneHint")}
        </FieldDescription>
        <Input
          id="client-profile-phone-staff"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={formatPhoneBrDisplay(draft.phoneDigits)}
          onChange={(e) => setField("phoneDigits", digitsOnlyPhone(e.target.value))}
          disabled={saving}
          className="w-full min-w-0 tabular-nums"
        />
      </Field>
    ) : null}
    <Field>
      <FieldLabel htmlFor="client-profile-cpf">{t("cpf")}</FieldLabel>
      <FieldDescription>
        {client.isMinor ? t("cpfHintMinor") : t("cpfHint")}
      </FieldDescription>
      <Input
        id="client-profile-cpf"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={formatCpfDisplay(draft.documentDigits)}
        onChange={(e) => setField("documentDigits", digitsOnlyCpf(e.target.value))}
        disabled={saving}
        className="w-full min-w-0 tabular-nums"
      />
    </Field>
    </>
  );
}

/** Nascimento, canal preferido e flag de menor (somente equipe). */
export function ClientProfileStaffBasicsSection({
  draft,
  setField,
  saving,
  isPatient,
}: ClientProfileSectionProps) {
  const t = useTranslations("clients.detail.profile");
  return (
    <>
    {!isPatient ? (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="client-birth-date">{t("birthDate")}</FieldLabel>
          <Input
            id="client-birth-date"
            type="date"
            autoComplete="bday"
            max={todayIsoDateLocal()}
            value={draft.birthDate}
            onChange={(e) => {
              const v = e.target.value;
              const max = todayIsoDateLocal();
              setField("birthDate", v && v > max ? max : v);
            }}
            disabled={saving}
            className="w-full min-w-0"
          />
        </Field>
        <Field>
          <FieldLabel>{t("preferredChannelField")}</FieldLabel>
          <Select
            value={draft.preferredChannel}
            onValueChange={(v) =>
              setField("preferredChannel", (v ?? PatientPreferredChannel.none) as PatientPreferredChannel)
            }
            disabled={saving}
          >
            <SelectTrigger className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PatientPreferredChannel.none}>
                {t("preferredChannelOption.none")}
              </SelectItem>
              <SelectItem value={PatientPreferredChannel.email}>
                {t("preferredChannelOption.email")}
              </SelectItem>
              <SelectItem value={PatientPreferredChannel.whatsapp}>
                {t("preferredChannelOption.whatsapp")}
              </SelectItem>
              <SelectItem value={PatientPreferredChannel.sms}>
                {t("preferredChannelOption.sms")}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    ) : null}

    {!isPatient ? (
      <label className="border-border flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
        <input
          type="checkbox"
          checked={draft.isMinor}
          onChange={(e) => {
            const v = e.target.checked;
            setField("isMinor", v);
            if (!v) {
              setField("guardianRelationship", REL_NONE);
            }
          }}
          disabled={saving}
          className="mt-0.5 size-4"
        />
        <span>{t("isMinor")}</span>
      </label>
    ) : null}
    </>
  );
}

"use client";

import type { PatientSelfRegisterFormValues } from "@/features/clients/app/utils/schemas";
import {
  FormBirthDateInput,
  FormCep,
  FormCpf,
  FormInput,
  FormPhoneNumber,
  FormSelect,
} from "@/shared/components/forms";
import { GuardianRelationship, PatientPreferredChannel } from "@prisma/client";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";

/** Seções de dados do paciente, responsável legal, emergência e endereço do auto-cadastro. */
export function SelfRegisterPersonalSections() {
  const t = useTranslations("clients");
  const form = useFormContext<PatientSelfRegisterFormValues>();
  const isMinorWatched = useWatch({ control: form.control, name: "isMinor" });

  const guardianRelationshipOptions = useMemo(
    () =>
      (
        [
          [GuardianRelationship.mother, "wizard.guardianRelationship.mother"],
          [GuardianRelationship.father, "wizard.guardianRelationship.father"],
          [GuardianRelationship.legal_guardian, "wizard.guardianRelationship.legal_guardian"],
          [GuardianRelationship.other, "wizard.guardianRelationship.other"],
        ] as const
      ).map(([value, key]) => ({ value, label: t(key) })),
    [t],
  );

  const preferredChannelOptions = useMemo(
    () =>
      (
        [
          [PatientPreferredChannel.none, "wizard.preferredChannelOption.none"],
          [PatientPreferredChannel.email, "wizard.preferredChannelOption.email"],
          [PatientPreferredChannel.whatsapp, "wizard.preferredChannelOption.whatsapp"],
          [PatientPreferredChannel.sms, "wizard.preferredChannelOption.sms"],
        ] as const
      ).map(([value, key]) => ({ value, label: t(key) })),
    [t],
  );

  return (
    <>
      <div className="bg-muted/40 space-y-4 rounded-lg border p-4">
        <p className="text-sm font-medium">{t("wizard.patientSection")}</p>
        <div className="grid grid-cols-1 gap-4 @min-[40rem]/patient-register:grid-cols-3">
          <div className="min-w-0">
            <FormInput name="name" label={t("wizard.name")} autoComplete="name" />
          </div>
          <div className="min-w-0">
            <FormPhoneNumber
              name="phone"
              label={isMinorWatched ? t("wizard.phoneMinor") : t("wizard.phone")}
              description={isMinorWatched ? t("wizard.phoneMinorHint") : t("wizard.phoneHint")}
              autoComplete="tel"
            />
          </div>
          <div className="min-w-0">
            <FormInput
              name="email"
              label={isMinorWatched ? t("wizard.emailMinor") : t("wizard.email")}
              description={isMinorWatched ? t("wizard.emailMinorHint") : t("wizard.emailHint")}
              type="email"
              autoComplete="email"
            />
          </div>
        </div>
        <FormCpf
          name="documentId"
          label={isMinorWatched ? t("wizard.documentIdMinor") : t("wizard.documentId")}
          description={isMinorWatched ? t("wizard.documentIdMinorHint") : t("wizard.documentIdHint")}
        />
        <div className="grid grid-cols-1 gap-4 @min-[40rem]/patient-register:grid-cols-2">
          <div className="min-w-0">
            <FormBirthDateInput
              name="birthDate"
              label={t("wizard.birthDate")}
              description={t("wizard.birthDateHint")}
              autoComplete="bday"
            />
          </div>
          <div className="min-w-0">
            <FormSelect
              name="preferredChannel"
              label={t("wizard.preferredChannelField")}
              description={t("wizard.preferredChannelHint")}
              options={preferredChannelOptions}
            />
          </div>
        </div>
        <Controller
          name="isMinor"
          control={form.control}
          render={({ field }) => (
            <label className="border-border bg-background/60 flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                checked={field.value}
                onChange={(e) => {
                  const checked = e.target.checked;
                  field.onChange(checked);
                  if (!checked) {
                    form.setValue("guardianName", "");
                    form.setValue("guardianDocumentId", "");
                    form.setValue("guardianPhone", "");
                    form.setValue("guardianEmail", "");
                    form.setValue("guardianRelationship", undefined);
                  }
                }}
                className="mt-0.5 size-4"
              />
              <span className="min-w-0">{t("wizard.isMinor")}</span>
            </label>
          )}
        />
      </div>
      {isMinorWatched ? (
        <div className="bg-muted/40 space-y-4 rounded-lg border p-4">
          <p className="text-sm font-medium">{t("wizard.guardianSection")}</p>
          <div className="grid grid-cols-1 gap-4 @min-[40rem]/patient-register:grid-cols-3">
            <div className="min-w-0">
              <FormInput name="guardianName" label={t("wizard.guardianName")} autoComplete="name" />
            </div>
            <div className="min-w-0">
              <FormCpf name="guardianDocumentId" label={t("wizard.guardianDocumentId")} />
            </div>
            <div className="min-w-0">
              <FormPhoneNumber name="guardianPhone" label={t("wizard.guardianPhone")} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 @min-[40rem]/patient-register:grid-cols-2">
            <div className="min-w-0">
              <FormSelect
                name="guardianRelationship"
                label={t("wizard.guardianRelationshipLabel")}
                description={t("wizard.guardianRelationshipHint")}
                placeholder={t("wizard.guardianRelationshipPlaceholder")}
                options={guardianRelationshipOptions}
              />
            </div>
            <div className="min-w-0">
              <FormInput
                name="guardianEmail"
                label={t("wizard.guardianEmail")}
                description={t("wizard.guardianEmailHint")}
                type="email"
                autoComplete="email"
              />
            </div>
          </div>
        </div>
      ) : null}
      <div className="bg-muted/40 space-y-4 rounded-lg border p-4">
        <p className="text-sm font-medium">{t("wizard.emergencySection")}</p>
        <div className="grid grid-cols-1 gap-4 @min-[40rem]/patient-register:grid-cols-2">
          <div className="min-w-0">
            <FormInput name="emergencyContactName" label={t("wizard.emergencyContactName")} />
          </div>
          <div className="min-w-0">
            <FormPhoneNumber name="emergencyContactPhone" label={t("wizard.emergencyContactPhone")} />
          </div>
        </div>
      </div>
      <div className="bg-muted/40 space-y-4 rounded-lg border p-4">
        <p className="text-sm font-medium">{t("wizard.addressSection")}</p>
        <div className="grid grid-cols-1 gap-4 @min-[30rem]/patient-register:grid-cols-2">
          <div className="min-w-0">
            <FormCep name="postalCode" label={t("wizard.postalCode")} description={t("wizard.postalCodeHint")} />
          </div>
          <div className="min-w-0">
            <FormInput name="addressLine" label={t("wizard.addressLine")} autoComplete="street-address" />
          </div>
          <div className="min-w-0">
            <FormInput name="addressNumber" label={t("wizard.addressNumber")} />
          </div>
          <div className="min-w-0">
            <FormInput name="addressComp" label={t("wizard.addressComp")} />
          </div>
          <div className="min-w-0">
            <FormInput name="neighborhood" label={t("wizard.neighborhood")} />
          </div>
          <div className="min-w-0">
            <FormInput name="city" label={t("wizard.city")} autoComplete="address-level2" />
          </div>
          <div className="min-w-0">
            <FormInput name="state" label={t("wizard.state")} maxLength={2} className="uppercase" />
          </div>
        </div>
      </div>
    </>
  );
}

"use client";

import { PICKER_NONE } from "@/features/clients/app/utils/new-client-payload";
import type { NewClientFormValues } from "@/features/clients/app/utils/schemas";
import {
  FormBirthDateInput,
  FormCep,
  FormCpf,
  FormInput,
  FormPhoneNumber,
  FormSelect,
  FormTextarea,
} from "@/shared/components/forms";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { GuardianRelationship, PatientPreferredChannel } from "@prisma/client";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";

type PickerMember = { userId: string; name: string | null; email: string };
type PickerSupplier = { id: string; name: string };

type NewClientPatientStepProps = {
  sessionReady: boolean;
  members: PickerMember[] | null;
  suppliers: PickerSupplier[] | null;
  pickersError: string | null;
  assignedToUserId: string;
  onAssignedChange: (value: string) => void;
  opmeSupplierId: string;
  onOpmeChange: (value: string) => void;
};

/** Etapa 1: dados do paciente, responsável legal, emergência, atribuição e endereço. */
export function NewClientPatientStep({
  sessionReady,
  members,
  suppliers,
  pickersError,
  assignedToUserId,
  onAssignedChange,
  opmeSupplierId,
  onOpmeChange,
}: NewClientPatientStepProps) {
  const t = useTranslations("clients.wizard");
  const form = useFormContext<NewClientFormValues>();
  const isMinorWatched = useWatch({ control: form.control, name: "isMinor" });

  const guardianRelationshipOptions = useMemo(
    () =>
      (
        [
          [GuardianRelationship.mother, "guardianRelationship.mother"],
          [GuardianRelationship.father, "guardianRelationship.father"],
          [GuardianRelationship.legal_guardian, "guardianRelationship.legal_guardian"],
          [GuardianRelationship.other, "guardianRelationship.other"],
        ] as const
      ).map(([value, key]) => ({ value, label: t(key) })),
    [t],
  );

  const preferredChannelOptions = useMemo(
    () =>
      (
        [
          [PatientPreferredChannel.none, "preferredChannelOption.none"],
          [PatientPreferredChannel.email, "preferredChannelOption.email"],
          [PatientPreferredChannel.whatsapp, "preferredChannelOption.whatsapp"],
          [PatientPreferredChannel.sms, "preferredChannelOption.sms"],
        ] as const
      ).map(([value, key]) => ({ value, label: t(key) })),
    [t],
  );

  return (
      <div className="flex flex-col gap-4">
        <div className="bg-muted/40 space-y-4 rounded-lg border p-4">
          <p className="text-sm font-medium">{t("patientSection")}</p>
          <div className="grid gap-4 lg:grid-cols-3">
            <FormInput name="name" label={t("name")} autoComplete="name" />
            <FormPhoneNumber
              name="phone"
              label={isMinorWatched ? t("phoneMinor") : t("phone")}
              description={isMinorWatched ? t("phoneMinorHint") : t("phoneHint")}
            />
            <FormInput
              name="email"
              label={isMinorWatched ? t("emailMinor") : t("email")}
              description={isMinorWatched ? t("emailMinorHint") : t("emailHint")}
              type="email"
              autoComplete="email"
            />
          </div>
          <FormCpf
            name="documentId"
            label={isMinorWatched ? t("documentIdMinor") : t("documentId")}
            description={isMinorWatched ? t("documentIdMinorHint") : t("documentIdHint")}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <FormBirthDateInput
              name="birthDate"
              label={t("birthDate")}
              description={t("birthDateHint")}
              autoComplete="bday"
            />
            <FormSelect
              name="preferredChannel"
              label={t("preferredChannelField")}
              description={t("preferredChannelHint")}
              options={preferredChannelOptions}
            />
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
                <span className="min-w-0">{t("isMinor")}</span>
              </label>
            )}
          />
        </div>
        {isMinorWatched ? (
          <div className="bg-muted/40 space-y-4 rounded-lg border p-4">
            <p className="text-sm font-medium">{t("guardianSection")}</p>
            <div className="grid gap-4 lg:grid-cols-3">
              <FormInput name="guardianName" label={t("guardianName")} autoComplete="name" />
              <FormCpf name="guardianDocumentId" label={t("guardianDocumentId")} />
              <FormPhoneNumber name="guardianPhone" label={t("guardianPhone")} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <FormSelect
                name="guardianRelationship"
                label={t("guardianRelationshipLabel")}
                description={t("guardianRelationshipHint")}
                placeholder={t("guardianRelationshipPlaceholder")}
                options={guardianRelationshipOptions}
              />
              <FormInput
                name="guardianEmail"
                label={t("guardianEmail")}
                description={t("guardianEmailHint")}
                type="email"
                autoComplete="email"
              />
            </div>
          </div>
        ) : null}
        <div className="bg-muted/40 space-y-4 rounded-lg border p-4">
          <p className="text-sm font-medium">{t("emergencySection")}</p>
          <div className="grid gap-4 lg:grid-cols-2">
            <FormInput name="emergencyContactName" label={t("emergencyContactName")} />
            <FormPhoneNumber name="emergencyContactPhone" label={t("emergencyContactPhone")} />
          </div>
        </div>
        {pickersError ? <p className="text-destructive text-sm">{pickersError}</p> : null}
        <div className="grid gap-4 lg:grid-cols-2">
          <Field>
            <FieldLabel>{t("assignedTo")}</FieldLabel>
            <Select
              value={assignedToUserId}
              onValueChange={(v) => onAssignedChange(v ?? PICKER_NONE)}
              disabled={!sessionReady || members === null}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder={t("assignedPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PICKER_NONE}>{t("noneOption")}</SelectItem>
                {(members ?? []).map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.name ?? m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>{t("opme")}</FieldLabel>
            <Select
              value={opmeSupplierId}
              onValueChange={(v) => onOpmeChange(v ?? PICKER_NONE)}
              disabled={!sessionReady || suppliers === null}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder={t("opmePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PICKER_NONE}>{t("noneOption")}</SelectItem>
                {(suppliers ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <FormTextarea
          name="caseDescription"
          label={t("caseDescription")}
          description={t("caseDescriptionHint")}
          rows={4}
        />
        <div className="bg-muted/40 space-y-4 rounded-lg border p-4">
          <p className="text-sm font-medium">{t("addressSection")}</p>
          <div className="grid gap-4 lg:grid-cols-2">
            <FormCep
              name="postalCode"
              label={t("postalCode")}
              description={t("postalCodeHint")}
            />
            <FormInput name="addressLine" label={t("addressLine")} autoComplete="street-address" />
            <FormInput name="addressNumber" label={t("addressNumber")} />
            <FormInput name="addressComp" label={t("addressComp")} required={false} />
            <FormInput name="neighborhood" label={t("neighborhood")} />
            <FormInput name="city" label={t("city")} autoComplete="address-level2" />
            <FormInput name="state" label={t("state")} maxLength={2} className="uppercase" />
          </div>
        </div>
      </div>
  );
}

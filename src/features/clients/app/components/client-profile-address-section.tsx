"use client";

import type { ClientProfileSectionProps } from "@/features/clients/app/types/client-profile";
import { digitsOnlyCep, formatCepDisplay } from "@/lib/validators/cep";
import { Field, FieldDescription, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { useTranslations } from "next-intl";

export function ClientProfileAddressSection({
  draft,
  setField,
  saving,
}: Pick<ClientProfileSectionProps, "draft" | "setField" | "saving">) {
  const t = useTranslations("clients.detail.profile");
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{t("addressSection")}</p>
      <Field>
        <FieldLabel htmlFor="addr-cep">{t("postalCode")}</FieldLabel>
        <FieldDescription>{t("postalCodeHint")}</FieldDescription>
        <Input
          id="addr-cep"
          inputMode="numeric"
          value={formatCepDisplay(draft.postalCode)}
          onChange={(e) => setField("postalCode", digitsOnlyCep(e.target.value))}
          disabled={saving}
          className="w-full min-w-0 tabular-nums"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="addr-line">{t("addressLine")}</FieldLabel>
        <Input
          id="addr-line"
          value={draft.addressLine}
          onChange={(e) => setField("addressLine", e.target.value)}
          disabled={saving}
          className="w-full min-w-0"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="addr-num">{t("addressNumber")}</FieldLabel>
          <Input
            id="addr-num"
            value={draft.addressNumber}
            onChange={(e) => setField("addressNumber", e.target.value)}
            disabled={saving}
            className="w-full min-w-0"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="addr-comp">{t("addressComp")}</FieldLabel>
          <Input
            id="addr-comp"
            value={draft.addressComp}
            onChange={(e) => setField("addressComp", e.target.value)}
            disabled={saving}
            className="w-full min-w-0"
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="addr-neigh">{t("neighborhood")}</FieldLabel>
        <Input
          id="addr-neigh"
          value={draft.neighborhood}
          onChange={(e) => setField("neighborhood", e.target.value)}
          disabled={saving}
          className="w-full min-w-0"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="addr-city">{t("city")}</FieldLabel>
          <Input
            id="addr-city"
            value={draft.city}
            onChange={(e) => setField("city", e.target.value)}
            disabled={saving}
            className="w-full min-w-0"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="addr-state">{t("state")}</FieldLabel>
          <Input
            id="addr-state"
            maxLength={2}
            className="w-full min-w-0 uppercase"
            value={draft.state}
            onChange={(e) => setField("state", e.target.value.toUpperCase())}
            disabled={saving}
          />
        </Field>
      </div>
    </div>
  );
}

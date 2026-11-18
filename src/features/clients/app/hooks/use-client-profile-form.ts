"use client";

import { useUpdateClient } from "@/features/clients/app/hooks/use-update-client";
import type { ClientProfileDraft } from "@/features/clients/app/types/client-profile";
import {
  buildPatientPatch,
  buildStaffPatch,
  draftFromClient,
  isProfileDirty,
  validateProfile,
} from "@/features/clients/app/utils/client-profile-form";
import { usePatchPatientPortalProfile } from "@/features/patient-portal/app/hooks/use-patch-patient-portal-profile";
import { toast } from "@/lib/toast";
import { getErrorMessage } from "@/lib/utils/error-message";
import type { ClientDetailClientDto } from "@/types/api/clients-v1";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

type UseClientProfileFormParams = {
  clientId: string;
  client: ClientDetailClientDto;
  isPatient: boolean;
  /** Obrigatório quando `isPatient`. */
  tenantSlug?: string;
};

export function useClientProfileForm({
  clientId,
  client,
  isPatient,
  tenantSlug,
}: UseClientProfileFormParams) {
  const t = useTranslations("clients.detail.profile");
  const tApi = useTranslations("api");
  const { updateClientById, updating: savingStaff } = useUpdateClient();
  const { patchProfile, saving: savingPatient } = usePatchPatientPortalProfile();

  const serverDraft = useMemo(() => draftFromClient(client), [client]);
  const serverKey = `${client.id}:${client.updatedAt}:${JSON.stringify(serverDraft)}`;
  const [draft, setDraft] = useState<ClientProfileDraft>(serverDraft);
  const [syncedKey, setSyncedKey] = useState(serverKey);
  // Dados do servidor mudaram (salvou/recarregou): o rascunho volta a refletir o registro.
  if (syncedKey !== serverKey) {
    setSyncedKey(serverKey);
    setDraft(serverDraft);
  }

  const setField = useCallback(
    <K extends keyof ClientProfileDraft>(key: K, value: ClientProfileDraft[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const dirty = useMemo(() => isProfileDirty(draft, client, isPatient), [draft, client, isPatient]);

  async function savePatientProfile() {
    const slug = tenantSlug?.trim();
    const body = buildPatientPatch(draft, client);
    if (!slug || Object.keys(body).length === 0) return;
    try {
      await patchProfile(slug, body);
      toast.success(t("saved"));
    } catch (e) {
      toast.error(getErrorMessage(e, t("saveError")));
    }
  }

  async function saveStaffProfile() {
    const body = buildStaffPatch(draft, client);
    if (Object.keys(body).length === 0) return;
    try {
      await updateClientById(clientId, body);
      toast.success(t("saved"));
    } catch {
      /* erro: toast global no apiClient */
    }
  }

  async function saveProfile() {
    const error = validateProfile({
      draft,
      client,
      isPatient,
      hasTenantSlug: Boolean(tenantSlug?.trim()),
    });
    if (error) {
      toast.error(
        error.scope === "api"
          ? tApi(error.key as Parameters<typeof tApi>[0])
          : t(error.key as Parameters<typeof t>[0]),
      );
      return;
    }
    await (isPatient ? savePatientProfile() : saveStaffProfile());
  }

  return {
    draft,
    setField,
    dirty,
    saving: isPatient ? savingPatient : savingStaff,
    saveProfile,
  };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import {
  getWhatsAppSettings,
  testWhatsAppConnection,
  updateWhatsAppSettings,
} from "@/features/settings/app/services/tenant-settings.service";
import type {
  UpdateWhatsAppSettingsRequestBody,
  WhatsAppSettingsDto,
} from "@/types/api/tenant-settings-v1";

const DEFAULT_SETTINGS: WhatsAppSettingsDto = {
  whatsappEnabled: false,
  whatsappPhoneNumberId: null,
  whatsappBusinessAccountId: null,
  hasAccessToken: false,
  whatsappVerifiedAt: null,
};

export function useWhatsAppSettings() {
  const { data: session, status: sessionStatus } = useSession();
  const [settings, setSettings] = useState<WhatsAppSettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const canEdit =
    session?.user?.tenantRole === "tenant_admin" ||
    session?.user?.globalRole === "super_admin";

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getWhatsAppSettings();
      setSettings(response.whatsapp);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar configurações.");
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    void reload();
  }, [reload, sessionStatus]);

  const save = useCallback(async (input: UpdateWhatsAppSettingsRequestBody) => {
    setSaving(true);
    try {
      const response = await updateWhatsAppSettings(input);
      setSettings(response.whatsapp);
      return response.whatsapp;
    } finally {
      setSaving(false);
    }
  }, []);

  const testConnection = useCallback(async () => {
    setTesting(true);
    try {
      const result = await testWhatsAppConnection();
      if (result.ok) {
        // Reload to get updated whatsappVerifiedAt
        await reload();
      }
      return result;
    } finally {
      setTesting(false);
    }
  }, [reload]);

  return {
    sessionStatus,
    settings: settings ?? DEFAULT_SETTINGS,
    hasLoaded: settings !== null,
    loading,
    error,
    saving,
    testing,
    canEdit,
    reload,
    save,
    testConnection,
  };
}

"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isQueryLoading } from "@/shared/utils/query-loading";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

import { settingsKeys } from "@/features/settings/app/hooks/query-keys";
import {
  deleteEmailDomain,
  getEmailDomainSettings,
  patchEmailDomain,
  postSetupEmailDomain,
  postVerifyEmailDomain,
} from "@/features/settings/app/services/email-domain.service";
import type { TenantEmailDomainDto } from "@/types/api/email-domain-v1";

const EMPTY: TenantEmailDomainDto = {
  outboundMode: "platform",
  emailEnabled: false,
  fromName: null,
  fromAddress: null,
  domainName: null,
  status: "none",
  dnsRecords: null,
  verifiedAt: null,
};

type EmailDomainResponse = { emailDomain: TenantEmailDomainDto };

type PatchInput = {
  emailOutboundMode?: "platform" | "smtp" | "resend_domain";
  emailEnabled?: boolean;
  fromName?: string;
  fromAddress?: string;
};

export function useEmailDomainSettings() {
  const t = useTranslations("settings.email");
  const { data: session, status: sessionStatus } = useSession();
  const queryClient = useQueryClient();

  const canEdit =
    session?.user?.tenantRole === "tenant_admin" || session?.user?.globalRole === "super_admin";

  const query = useQuery({
    queryKey: settingsKeys.emailDomain,
    queryFn: ({ signal }) => getEmailDomainSettings({ signal }),
    enabled: sessionStatus === "authenticated",
    select: (response) => response.emailDomain,
  });
  const { refetch } = query;

  const store = (response: EmailDomainResponse) =>
    queryClient.setQueryData(settingsKeys.emailDomain, response);

  const setupMutation = useMutation({
    mutationFn: postSetupEmailDomain,
    onSuccess: store,
  });
  const verifyMutation = useMutation({ mutationFn: postVerifyEmailDomain, onSuccess: store });
  const removeMutation = useMutation({ mutationFn: deleteEmailDomain, onSuccess: store });
  const patchMutation = useMutation({
    mutationFn: (input: PatchInput) => patchEmailDomain(input),
    onSuccess: store,
  });
  const { mutateAsync: setupAsync } = setupMutation;
  const { mutateAsync: verifyAsync } = verifyMutation;
  const { mutateAsync: removeAsync } = removeMutation;
  const { mutateAsync: patchAsync } = patchMutation;

  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);
  const setup = useCallback(
    async (input: { domainName: string; fromName: string; localPart: string }) => {
      await setupAsync(input);
    },
    [setupAsync],
  );
  const verify = useCallback(async () => {
    await verifyAsync();
  }, [verifyAsync]);
  const remove = useCallback(async () => {
    await removeAsync();
  }, [removeAsync]);
  const patch = useCallback(
    async (input: PatchInput) => {
      await patchAsync(input);
    },
    [patchAsync],
  );

  return {
    sessionStatus,
    emailDomain: query.data ?? EMPTY,
    hasLoaded: query.data !== undefined,
    loading: isQueryLoading(query),
    error: query.error ? query.error.message || t("loadError") : null,
    busy:
      setupMutation.isPending ||
      verifyMutation.isPending ||
      removeMutation.isPending ||
      patchMutation.isPending,
    canEdit,
    reload,
    setup,
    verify,
    remove,
    patch,
  };
}

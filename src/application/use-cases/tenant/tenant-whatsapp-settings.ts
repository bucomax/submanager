import type { TenantWhatsAppPatchInput } from "@/application/ports/tenant-repository.port";
import { encryptTenantSecret } from "@/infrastructure/crypto/tenant-secret";
import { tenantPrismaRepository } from "@/infrastructure/repositories/tenant.repository";
import { patchWhatsAppSettingsBodySchema } from "@/lib/validators/tenant-whatsapp";
import type { z } from "zod";

export function tenantWhatsAppToDto(tenant: {
  whatsappEnabled: boolean;
  whatsappPhoneNumberId: string | null;
  whatsappBusinessAccountId: string | null;
  whatsappAccessTokenEnc: string | null;
  whatsappVerifiedAt: Date | null;
}) {
  return {
    whatsappEnabled: tenant.whatsappEnabled,
    whatsappPhoneNumberId: tenant.whatsappPhoneNumberId,
    whatsappBusinessAccountId: tenant.whatsappBusinessAccountId,
    hasAccessToken: Boolean(tenant.whatsappAccessTokenEnc),
    whatsappVerifiedAt: tenant.whatsappVerifiedAt?.toISOString() ?? null,
  };
}

export async function getTenantWhatsAppSettings(tenantId: string) {
  return tenantPrismaRepository.findTenantWhatsAppById(tenantId);
}

export type PatchWhatsAppInput = z.infer<typeof patchWhatsAppSettingsBodySchema>;

export async function patchTenantWhatsAppSettings(params: {
  tenantId: string;
  data: PatchWhatsAppInput;
}) {
  const { tenantId, data } = params;
  const { whatsappAccessToken, ...rest } = data;

  const patch: TenantWhatsAppPatchInput = { ...rest };

  if (whatsappAccessToken !== undefined) {
    if (whatsappAccessToken === null) {
      patch.whatsappAccessTokenEnc = null;
    } else {
      patch.whatsappAccessTokenEnc = encryptTenantSecret(whatsappAccessToken);
    }
    patch.resetWhatsAppVerifiedAt = true;
  }

  return tenantPrismaRepository.updateTenantWhatsApp(tenantId, patch);
}

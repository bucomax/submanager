import type { ParsedPortalLogin } from "@/domain/auth/patient-portal-login-identifier";
import type { PortalClientForLogin } from "@/types/api/patient-portal-v1";

export interface IPortalLoginClientFinder {
  findForPortalLogin(tenantId: string, parsed: ParsedPortalLogin): Promise<PortalClientForLogin | null>;
}

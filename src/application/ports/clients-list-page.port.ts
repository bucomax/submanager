import type { TenantMembershipClientScope } from "@/domain/client/client-visibility";
import type { ClientListRow } from "@/application/use-cases/client/serialize-client-list";

export type ClientsListPageArgs = {
  tenantId: string;
  viewerUserId: string;
  globalRole: string;
  scope: TenantMembershipClientScope;
  limit: number;
  page: number;
  q?: string;
  pathwayId?: string;
  stageId?: string;
};

export interface IClientsListPageReader {
  getPage(args: ClientsListPageArgs): Promise<{ items: ClientListRow[]; total: number }>;
}

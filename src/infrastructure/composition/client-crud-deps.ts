import type { CreateClientDeps } from "@/application/use-cases/client/create-client.core";
import type { DeleteClientDeps } from "@/application/use-cases/client/delete-client.core";
import type { ListClientsPageDeps } from "@/application/use-cases/client/list-clients-page.core";
import type { UpdateClientDeps } from "@/application/use-cases/client/update-client.core";
import { getClientsListPageWithoutCache } from "@/infrastructure/cache/cached-clients-list";
import { tenantListCache } from "@/infrastructure/composition/shared-adapters";
import { prisma } from "@/infrastructure/database/prisma";
import { clientPrismaRepository } from "@/infrastructure/repositories/client.repository";
import { createPrismaAuditRecorder } from "@/infrastructure/repositories/audit-recorder.repository";
import { userPrismaRepository } from "@/infrastructure/repositories/user.repository";
import { prismaClientVisibilityScopeReader } from "@/infrastructure/visibility/client-visibility-scope";
import { mergeClientWhereWithVisibility } from "@/infrastructure/visibility/client-visibility-where";

const audit = createPrismaAuditRecorder(prisma);

export const defaultClientCrudDeps: CreateClientDeps & UpdateClientDeps & DeleteClientDeps & ListClientsPageDeps = {
  clients: clientPrismaRepository,
  memberships: userPrismaRepository,
  audit,
  cache: tenantListCache,
  scopes: prismaClientVisibilityScopeReader,
  listPage: { getPage: getClientsListPageWithoutCache },
  visibleWhere: mergeClientWhereWithVisibility,
};

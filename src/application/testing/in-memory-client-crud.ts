import type { IClientVisibilityScopeReader } from "@/application/ports/client-visibility-scope-reader.port";
import type { CreateClientDeps } from "@/application/use-cases/client/create-client.core";
import type { DeleteClientDeps } from "@/application/use-cases/client/delete-client.core";
import type { ListClientsPageDeps } from "@/application/use-cases/client/list-clients-page.core";
import type { UpdateClientDeps } from "@/application/use-cases/client/update-client.core";
import { auditRecorderFor, FakeTenantListCache, type AuditLog } from "@/application/testing/in-memory-unit-of-work";
import { resolveClientScope, type TenantMembershipScopeRow } from "@/domain/client/client-visibility";

export type FakeClientRow = {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email: string | null;
  isMinor: boolean;
  guardianName: string | null;
  assignedToUserId: string | null;
  opmeSupplierId: string | null;
  deletedAt: Date | null;
};

export type ClientCrudWorld = AuditLog & {
  clients: FakeClientRow[];
  /** `tenantId:userId` → papel no tenant (membership). */
  roles: Map<string, string>;
  scopeMemberships: Map<string, TenantMembershipScopeRow>;
  /** Últimos argumentos recebidos pela listagem paginada (para provar escopo/tenant). */
  listCalls: { args: unknown }[];
  scanRows: unknown[];
};

export function createClientCrudWorld(): ClientCrudWorld {
  return { audits: [], clients: [], roles: new Map(), scopeMemberships: new Map(), listCalls: [], scanRows: [] };
}

/** Linha Prisma completa mínima aceita por `mapPrismaClientRowToClientDto` / `serializeClientListItem`. */
export function fullClientRow(row: Partial<FakeClientRow> & { id: string }) {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    name: "Paciente", phone: "11999990000", email: null, caseDescription: null, documentId: null,
    postalCode: null, addressLine: null, addressNumber: null, addressComp: null, neighborhood: null,
    city: null, state: null, isMinor: false, birthDate: null, guardianName: null, guardianDocumentId: null,
    guardianPhone: null, guardianEmail: null, guardianRelationship: null, emergencyContactName: null,
    emergencyContactPhone: null, preferredChannel: "whatsapp", assignedToUserId: null, opmeSupplierId: null,
    createdAt: now, updatedAt: now, assignedTo: null, opmeSupplier: null, patientPathways: [],
    ...row,
  };
}

export function createClientCrudDeps(world: ClientCrudWorld): CreateClientDeps &
  UpdateClientDeps &
  DeleteClientDeps &
  ListClientsPageDeps & { cache: FakeTenantListCache } {
  const cache = new FakeTenantListCache();
  const scopes: IClientVisibilityScopeReader = {
    async loadScope(userId, tenantId, globalRole) {
      return resolveClientScope(globalRole, world.scopeMemberships.get(`${tenantId}:${userId}`) ?? null);
    },
  };

  return {
    cache,
    audit: auditRecorderFor(world),
    scopes,
    memberships: {
      async getTenantMembershipRole(tenantId, userId) {
        return (world.roles.get(`${tenantId}:${userId}`) ?? null) as never;
      },
    },
    clients: {
      async createClientStaff(data) {
        const d = data as Partial<FakeClientRow> & { tenantId: string };
        const row = { ...d, id: `c${world.clients.length + 1}`, deletedAt: null } as FakeClientRow;
        world.clients.push(row);
        return fullClientRow(row);
      },
      async updateClientStaff(tenantId, clientId, data) {
        const row = world.clients.find((c) => c.id === clientId && c.tenantId === tenantId && !c.deletedAt);
        if (!row) throw new Error("Record to update not found");
        Object.assign(row, data);
        return fullClientRow(row);
      },
      async delete(tenantId, clientId) {
        const row = world.clients.find((c) => c.id === clientId && c.tenantId === tenantId && !c.deletedAt);
        if (!row) return false;
        row.deletedAt = new Date();
        return true;
      },
      async findManyForClientsListScan() {
        return world.scanRows;
      },
    },
    listPage: {
      async getPage(args) {
        world.listCalls.push({ args });
        return { items: [], total: 0 };
      },
    },
    visibleWhere: (base, scope, viewerUserId) =>
      ({ AND: [base, { scope, viewerUserId }] }) as unknown as typeof base,
  };
}

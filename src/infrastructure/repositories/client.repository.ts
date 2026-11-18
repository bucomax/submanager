import type { Prisma } from "@prisma/client";

import type { ClientListFilters, ClientUpsertInput, IClientRepository } from "@/application/ports/client-repository.port";
import { CLIENT_LIST_INCLUDE } from "@/infrastructure/repositories/client-query-shapes";
import type { ParsedPortalLogin } from "@/domain/auth/patient-portal-login-identifier";
import { prisma } from "@/infrastructure/database/prisma";
import type { PatientPortalOverviewResponse, PortalClientForLogin } from "@/types/api/patient-portal-v1";

const portalLoginSelect = {
  id: true,
  email: true,
  phone: true,
  name: true,
  documentId: true,
  isMinor: true,
  guardianPhone: true,
  guardianEmail: true,
  portalPasswordHash: true,
  portalPasswordChangedAt: true,
} satisfies Prisma.ClientSelect;

const patientPortalDetailClientSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  caseDescription: true,
  documentId: true,
  postalCode: true,
  addressLine: true,
  addressNumber: true,
  addressComp: true,
  neighborhood: true,
  city: true,
  state: true,
  isMinor: true,
  birthDate: true,
  guardianName: true,
  guardianDocumentId: true,
  guardianPhone: true,
  guardianEmail: true,
  guardianRelationship: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  preferredChannel: true,
  assignedToUserId: true,
  opmeSupplierId: true,
  portalPasswordHash: true,
  createdAt: true,
  updatedAt: true,
  assignedTo: { select: { id: true, name: true, email: true } },
  opmeSupplier: { select: { id: true, name: true } },
} as const satisfies Prisma.ClientSelect;

/** Select alinhado a `mapPrismaClientRowToClientDto` (create/update staff). */
const clientStaffDtoSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  caseDescription: true,
  documentId: true,
  postalCode: true,
  addressLine: true,
  addressNumber: true,
  addressComp: true,
  neighborhood: true,
  city: true,
  state: true,
  isMinor: true,
  birthDate: true,
  guardianName: true,
  guardianDocumentId: true,
  guardianPhone: true,
  guardianEmail: true,
  guardianRelationship: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  preferredChannel: true,
  assignedToUserId: true,
  opmeSupplierId: true,
  createdAt: true,
  updatedAt: true,
  assignedTo: { select: { id: true, name: true, email: true } },
  opmeSupplier: { select: { id: true, name: true } },
  patientPathways: {
    where: { completedAt: null },
    take: 1,
    orderBy: { createdAt: "desc" },
    select: { id: true },
  },
} as const satisfies Prisma.ClientSelect;

function buildWherePortalLogin(tenantId: string, parsed: ParsedPortalLogin): Prisma.ClientWhereInput {
  if (parsed.kind === "cpf") {
    return {
      tenantId,
      deletedAt: null,
      OR: [{ documentId: parsed.cpf11 }, { isMinor: true, guardianDocumentId: parsed.cpf11 }],
    };
  }
  return {
    tenantId,
    deletedAt: null,
    email: { equals: parsed.emailNorm, mode: "insensitive" },
  };
}

function toCreateData(input: ClientUpsertInput): Prisma.ClientCreateInput {
  return {
    tenant: { connect: { id: input.tenantId } },
    name: input.name,
    phone: input.phone,
    email: input.email ?? null,
    documentId: input.cpf ?? null,
    birthDate: input.birthDate ?? null,
    caseDescription: input.notes ?? null,
    ...(input.assignedToUserId
      ? { assignedTo: { connect: { id: input.assignedToUserId } } }
      : {}),
    ...(input.opmeSupplierId ? { opmeSupplier: { connect: { id: input.opmeSupplierId } } } : {}),
  };
}

export class ClientPrismaRepository implements IClientRepository {
  async create(input: ClientUpsertInput) {
    const row = await prisma.client.create({
      data: toCreateData(input),
      select: { id: true },
    });
    return row;
  }

  async findById(tenantId: string, clientId: string) {
    return prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
    });
  }

  async findByIdWithPathways(tenantId: string, clientId: string) {
    return prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
      include: {
        patientPathways: {
          orderBy: { updatedAt: "desc" },
          take: 50,
          include: {
            pathway: { select: { id: true, name: true } },
            currentStage: { select: { id: true, name: true, stageKey: true } },
          },
        },
      },
    });
  }

  async findForPortalLogin(tenantId: string, parsed: ParsedPortalLogin): Promise<PortalClientForLogin | null> {
    return prisma.client.findFirst({
      where: buildWherePortalLogin(tenantId, parsed),
      // documentId não é único (responsável com vários menores): sem ordem fixa, o OTP pedido
      // para um paciente poderia ser verificado contra outro.
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: portalLoginSelect,
    });
  }

  async findMany(filters: ClientListFilters) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    const q = filters.search?.trim();

    return prisma.client.findMany({
      where: {
        tenantId: filters.tenantId,
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(filters.assignedToUserId ? { assignedToUserId: filters.assignedToUserId } : {}),
        ...(filters.opmeSupplierId ? { opmeSupplierId: filters.opmeSupplierId } : {}),
        ...(filters.pathwayId
          ? {
              patientPathways: {
                some: { pathwayId: filters.pathwayId, completedAt: null },
              },
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip,
    });
  }

  async update(tenantId: string, clientId: string, input: Partial<ClientUpsertInput>) {
    const existing = await prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return null;

    const data: Prisma.ClientUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.email !== undefined) data.email = input.email;
    if (input.cpf !== undefined) data.documentId = input.cpf;
    if (input.birthDate !== undefined) data.birthDate = input.birthDate;
    if (input.notes !== undefined) data.caseDescription = input.notes;
    if (input.assignedToUserId !== undefined) {
      data.assignedTo = input.assignedToUserId
        ? { connect: { id: input.assignedToUserId } }
        : { disconnect: true };
    }
    if (input.opmeSupplierId !== undefined) {
      data.opmeSupplier = input.opmeSupplierId
        ? { connect: { id: input.opmeSupplierId } }
        : { disconnect: true };
    }

    return prisma.client.update({
      where: { id: clientId },
      data,
    });
  }

  async delete(tenantId: string, clientId: string, deletedByUserId: string) {
    const now = new Date();
    const result = await prisma.client.updateMany({
      where: { id: clientId, tenantId, deletedAt: null },
      data: { deletedAt: now, deletedByUserId },
    });
    return result.count > 0;
  }

  async findFirstWhere(where: unknown, select: unknown) {
    return prisma.client.findFirst({
      where: where as Prisma.ClientWhereInput,
      select: select as Prisma.ClientSelect,
    });
  }

  async findClientAssigneeSummary(tenantId: string, clientId: string) {
    return prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
      select: { id: true, assignedToUserId: true, opmeSupplierId: true },
    });
  }

  async findClientsAssigneeFieldsByIds(tenantId: string, clientIds: string[]) {
    if (clientIds.length === 0) {
      return [];
    }
    return prisma.client.findMany({
      where: { id: { in: clientIds }, tenantId, deletedAt: null },
      select: { id: true, assignedToUserId: true, opmeSupplierId: true },
    });
  }

  async listPatientNotesPage(tenantId: string, clientId: string, page: number, limit: number) {
    const offset = (page - 1) * limit;
    const where = { tenantId, clientId };

    const [totalItems, rows] = await Promise.all([
      prisma.patientNote.count({ where }),
      prisma.patientNote.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        select: {
          id: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    return { totalItems, rows };
  }

  async createPatientNote(params: {
    tenantId: string;
    clientId: string;
    authorUserId: string;
    content: string;
  }) {
    return prisma.patientNote.create({
      data: {
        tenantId: params.tenantId,
        clientId: params.clientId,
        authorUserId: params.authorUserId,
        content: params.content,
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async findClientNameById(tenantId: string, clientId: string) {
    const row = await prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
      select: { name: true },
    });
    const n = row?.name?.trim();
    return n && n.length > 0 ? n : null;
  }

  async findClientForPortalPatch(tenantId: string, clientId: string) {
    return prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
      select: { id: true, isMinor: true },
    });
  }

  async updatePatientPortalProfile(clientId: string, data: unknown) {
    return prisma.client.update({
      where: { id: clientId },
      data: data as Prisma.ClientUncheckedUpdateInput,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        documentId: true,
        postalCode: true,
        addressLine: true,
        addressNumber: true,
        addressComp: true,
        neighborhood: true,
        city: true,
        state: true,
        isMinor: true,
        guardianName: true,
        guardianDocumentId: true,
        guardianPhone: true,
        updatedAt: true,
      },
    });
  }

  async loadPatientPortalOverview(
    tenantId: string,
    clientId: string,
  ): Promise<PatientPortalOverviewResponse | null> {
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        tenantId,
        deletedAt: null,
      },
      select: { name: true, email: true },
    });
    if (!client) {
      return null;
    }

    const [tenant, activePp] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      }),
      prisma.patientPathway.findFirst({
        where: {
          clientId,
          tenantId,
          completedAt: null,
        },
        select: {
          id: true,
          enteredStageAt: true,
          pathway: { select: { name: true } },
          currentStage: { select: { name: true } },
        },
      }),
    ]);

    return {
      client: { name: client.name, email: client.email },
      tenant: { name: tenant?.name ?? "—" },
      activeJourney: activePp
        ? {
            patientPathwayId: activePp.id,
            pathwayName: activePp.pathway.name,
            currentStageName: activePp.currentStage.name,
            enteredStageAt: activePp.enteredStageAt.toISOString(),
          }
        : null,
    };
  }

  async findClientPortalPasswordRow(tenantId: string, clientId: string) {
    return prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
      select: { id: true, portalPasswordHash: true },
    });
  }

  async updatePatientPortalPasswordHash(
    clientId: string,
    portalPasswordHash: string,
    portalPasswordChangedAt: Date,
  ) {
    await prisma.client.update({
      where: { id: clientId },
      data: { portalPasswordHash, portalPasswordChangedAt },
    });
  }

  async findClientForPatientPortalDetail(tenantId: string, clientId: string) {
    return prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
      select: patientPortalDetailClientSelect,
    });
  }

  async findManyForClientsListScan(params: { where: unknown; skip: number; take: number }) {
    return prisma.client.findMany({
      where: params.where as Prisma.ClientWhereInput,
      orderBy: { updatedAt: "desc" },
      take: params.take,
      skip: params.skip,
      include: CLIENT_LIST_INCLUDE,
    });
  }

  async createClientStaff(data: unknown) {
    return prisma.client.create({
      data: data as Prisma.ClientUncheckedCreateInput,
      select: clientStaffDtoSelect,
    });
  }

  async updateClientStaff(tenantId: string, clientId: string, data: unknown) {
    return prisma.client.update({
      where: { id: clientId, tenantId, deletedAt: null },
      data: data as Prisma.ClientUncheckedUpdateInput,
      select: clientStaffDtoSelect,
    });
  }
}

export const clientPrismaRepository = new ClientPrismaRepository();

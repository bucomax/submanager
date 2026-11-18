import type { Prisma } from "@prisma/client";

/**
 * Formas de consulta Prisma de paciente (include/select, where de listagem, reidratação de cache).
 * Vivem em infrastructure; a application reexporta para os serializers.
 */

/** Include alinhado a `GET /api/v1/clients` (listagem). */
export const CLIENT_LIST_INCLUDE = {
  assignedTo: { select: { id: true, name: true, email: true } },
  opmeSupplier: { select: { id: true, name: true } },
  patientPathways: {
    orderBy: { updatedAt: "desc" as const },
    take: 1,
    select: {
      id: true,
      completedAt: true,
      pathwayId: true,
      enteredStageAt: true,
      pathway: { select: { name: true } },
      currentStage: {
        select: {
          id: true,
          name: true,
          alertWarningDays: true,
          alertCriticalDays: true,
        },
      },
    },
  },
} satisfies Prisma.ClientInclude;

export type ClientListRow = Prisma.ClientGetPayload<{ include: typeof CLIENT_LIST_INCLUDE }>;

export function clientSearchWhere(q: string): Prisma.ClientWhereInput {
  const qDigits = q.replace(/\D/g, "");
  const or: Prisma.ClientWhereInput[] = [
    { name: { contains: q, mode: "insensitive" } },
    { phone: { contains: q, mode: "insensitive" } },
    { email: { contains: q, mode: "insensitive" } },
  ];
  if (qDigits.length > 0) {
    or.push({ documentId: { contains: qDigits, mode: "insensitive" } });
  }
  return { OR: or };
}

export function buildClientsListBaseWhere(input: {
  tenantId: string;
  q?: string;
  pathwayId?: string;
  stageId?: string;
}): Prisma.ClientWhereInput {
  const { tenantId, q, pathwayId, stageId } = input;
  const ppFilter: Prisma.PatientPathwayWhereInput = { tenantId };
  if (pathwayId) ppFilter.pathwayId = pathwayId;
  if (stageId) ppFilter.currentStageId = stageId;
  const hasPpFilter = Boolean(pathwayId || stageId);
  return {
    tenantId,
    deletedAt: null,
    ...(q ? clientSearchWhere(q) : {}),
    ...(hasPpFilter ? { patientPathways: { some: ppFilter } } : {}),
  };
}

/** Após `unstable_cache`, o Next serializa `Date` como string — reidrata para o SLA usar `now` atual. */
export function reviveClientListRows(raw: unknown): ClientListRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(reviveClientListRow);
}

function reviveClientListRow(raw: unknown): ClientListRow {
  const c = raw as Record<string, unknown>;
  const ppsRaw = c.patientPathways;
  const patientPathways = Array.isArray(ppsRaw)
    ? ppsRaw.map((pp) => {
        const row = pp as Record<string, unknown>;
        const cs = row.currentStage as Record<string, unknown> | null;
        return {
          ...row,
          enteredStageAt: toDate(row.enteredStageAt),
          completedAt: row.completedAt ? toDate(row.completedAt) : null,
          pathway: row.pathway,
          currentStage: cs
            ? {
                ...cs,
                alertWarningDays: Number(cs.alertWarningDays),
                alertCriticalDays: Number(cs.alertCriticalDays),
              }
            : null,
        };
      })
    : [];

  return {
    ...c,
    createdAt: toDate(c.createdAt),
    updatedAt: toDate(c.updatedAt),
    assignedTo: c.assignedTo,
    opmeSupplier: c.opmeSupplier,
    patientPathways,
  } as ClientListRow;
}

function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return new Date(NaN);
}

/** Include usado na ficha do paciente (jornada ativa e histórico concluído). */
export const clientDetailPatientPathwaySelect = {
  id: true,
  createdAt: true,
  completedAt: true,
  enteredStageAt: true,
  pathway: { select: { id: true, name: true } },
  pathwayVersion: {
    select: {
      id: true,
      version: true,
      stages: {
        orderBy: { sortOrder: "asc" as const },
        select: {
          id: true,
          name: true,
          stageKey: true,
          sortOrder: true,
          patientMessage: true,
          alertWarningDays: true,
          alertCriticalDays: true,
          defaultAssigneeUserId: true,
          defaultAssigneeUserIds: true,
          stageDocuments: {
            orderBy: { sortOrder: "asc" as const },
            select: {
              id: true,
              sortOrder: true,
              fileAsset: {
                select: { id: true, fileName: true, mimeType: true },
              },
            },
          },
          checklistItems: {
            orderBy: { sortOrder: "asc" as const },
            select: {
              id: true,
              label: true,
              sortOrder: true,
              requiredForTransition: true,
            },
          },
          defaultAssigneeUser: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  },
  currentStage: {
    select: {
      id: true,
      name: true,
      stageKey: true,
      sortOrder: true,
      patientMessage: true,
      alertWarningDays: true,
      alertCriticalDays: true,
      defaultAssigneeUserId: true,
    },
  },
  currentStageAssigneeUserId: true,
  currentStageAssignee: {
    select: { id: true, name: true, email: true },
  },
  checklistItems: {
    select: {
      checklistItemId: true,
      completedAt: true,
    },
  },
} satisfies Prisma.PatientPathwaySelect;

export type ClientDetailPatientPathwayRow = Prisma.PatientPathwayGetPayload<{
  select: typeof clientDetailPatientPathwaySelect;
}>;

/** Teto de transições carregadas no histórico concluído (+1 para detectar truncamento). */
export const MAX_COMPLETED_TRANSITIONS = 400;

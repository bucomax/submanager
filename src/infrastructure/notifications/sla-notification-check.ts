import { logger } from "@/lib/observability/logger";
import type { NotificationType } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";
import { resolvePathwayNotificationTargetUserIds } from "@/infrastructure/notifications/resolve-notification-targets";
import { enqueueEmailDispatch } from "@/infrastructure/email/email-dispatch-emitter";
import { notificationEmitter } from "./notification-emitter";
import { computeSlaHealthStatus } from "@/domain/pathway/sla-health";
import { buildSlaDedupeKey } from "./sla-dedupe-key";
import { rotateForDailySweep } from "./sla-sweep-rotation";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type SlaCheckInput = {
  tenantId: string;
  pathwayId: string;
  versionId: string;
};

const SLA_NOTIFICATION_TYPES: NotificationType[] = ["sla_warning", "sla_critical"];
/** Teto de notificações legadas (sem `dedupeKey`) lidas por checagem. */
const LEGACY_SCAN_LIMIT = 5_000;

async function loadSlaPatients(input: SlaCheckInput) {
  return prisma.patientPathway.findMany({
    where: {
      tenantId: input.tenantId,
      pathwayId: input.pathwayId,
      pathwayVersionId: input.versionId,
      completedAt: null,
      client: { deletedAt: null },
    },
    select: {
      id: true,
      clientId: true,
      enteredStageAt: true,
      currentStageAssigneeUserId: true,
      client: { select: { name: true } },
      currentStage: {
        select: {
          id: true,
          name: true,
          alertWarningDays: true,
          alertCriticalDays: true,
        },
      },
    },
  });
}

type SlaPatient = Awaited<ReturnType<typeof loadSlaPatients>>[number];

type SlaCandidate = {
  patient: SlaPatient;
  notifType: NotificationType;
  severity: "warning" | "danger";
  daysInStage: number;
  dedupeKey: string;
};

/** Pacientes em `warning`/`danger`, cada um com a chave determinística do alerta (por nível e entrada na etapa). */
function toSlaCandidates(patients: SlaPatient[], now: Date): SlaCandidate[] {
  return patients.flatMap((patient): SlaCandidate[] => {
    const status = computeSlaHealthStatus(
      patient.enteredStageAt,
      now,
      patient.currentStage.alertWarningDays,
      patient.currentStage.alertCriticalDays,
    );
    if (status !== "warning" && status !== "danger") return [];
    return [
      {
        patient,
        notifType: status === "danger" ? "sla_critical" : "sla_warning",
        severity: status,
        daysInStage: Math.floor((now.getTime() - patient.enteredStageAt.getTime()) / MS_PER_DAY),
        dedupeKey: buildSlaDedupeKey({
          patientPathwayId: patient.id,
          stageId: patient.currentStage.id,
          enteredStageAt: patient.enteredStageAt,
          level: status === "danger" ? "critical" : "warning",
        }),
      },
    ];
  });
}

function readMetadataString(metadata: unknown, field: string): string | null {
  if (metadata === null || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
}

/**
 * Chaves de alerta já emitidas, em lote (2 queries por checagem, não 1 por paciente).
 * A garantia atômica contra duplicata é o `@@unique([userId, dedupeKey])` no insert; isto só evita trabalho.
 */
async function findAlreadyAlertedKeys(tenantId: string, candidates: SlaCandidate[]): Promise<Set<string>> {
  const rows = await prisma.notification.findMany({
    where: { tenantId, dedupeKey: { in: candidates.map((c) => c.dedupeKey) } },
    select: { dedupeKey: true },
    distinct: ["dedupeKey"],
  });
  const alerted = new Set(rows.flatMap((r) => (r.dedupeKey ? [r.dedupeKey] : [])));

  const pending = candidates.filter((c) => !alerted.has(c.dedupeKey));
  if (pending.length === 0) return alerted;

  // Compat: notificações anteriores à coluna `dedupeKey` guardavam a chave em `metadata.slaDedupeKey`
  // (ou nem isso: "já alertou desde que entrou na etapa"). Remover quando não restarem linhas sem chave.
  const oldestEntered = new Date(Math.min(...pending.map((c) => c.patient.enteredStageAt.getTime())));
  const legacy = await prisma.notification.findMany({
    where: {
      tenantId,
      type: { in: SLA_NOTIFICATION_TYPES },
      dedupeKey: null,
      createdAt: { gte: oldestEntered },
    },
    select: { type: true, createdAt: true, metadata: true },
    orderBy: { createdAt: "desc" },
    take: LEGACY_SCAN_LIMIT,
  });
  for (const candidate of pending) {
    const alertedBefore = legacy.some(
      (n) =>
        n.type === candidate.notifType &&
        (readMetadataString(n.metadata, "slaDedupeKey") === candidate.dedupeKey ||
          (n.createdAt >= candidate.patient.enteredStageAt &&
            readMetadataString(n.metadata, "patientPathwayId") === candidate.patient.id)),
    );
    if (alertedBefore) alerted.add(candidate.dedupeKey);
  }
  return alerted;
}

type SlaAlertContext = {
  tenantId: string;
  clinicName: string;
  emailEnabled: boolean;
  resolveTargets: (candidate: SlaCandidate) => Promise<string[]>;
};

/**
 * Emite a notificação in-app (dedupe atômico por usuário via `dedupeKey`) e o e-mail à equipe.
 * O e-mail é deduplicado pelo `jobId` determinístico (fila ou `DispatchKey` sem fila), então duas
 * checagens concorrentes do mesmo alerta resultam em 1 notificação por usuário e 1 e-mail.
 */
async function emitSlaAlert(ctx: SlaAlertContext, candidate: SlaCandidate): Promise<void> {
  const { patient, notifType, severity, daysInStage, dedupeKey } = candidate;
  const targetUserIds = await ctx.resolveTargets(candidate);

  await notificationEmitter
    .emit({
      tenantId: ctx.tenantId,
      type: notifType,
      title: `${severity === "danger" ? "Alerta crítico" : "Atenção"}: ${patient.client.name}`,
      body: `${daysInStage} dias na etapa "${patient.currentStage.name}".`,
      targetUserIds,
      dedupeKey,
      metadata: {
        clientId: patient.clientId,
        patientPathwayId: patient.id,
        stageId: patient.currentStage.id,
        stageName: patient.currentStage.name,
        daysInStage,
        slaDedupeKey: dedupeKey,
      },
    })
    .catch((err) => logger.error("[notification] sla emit failed", { tenantId: ctx.tenantId, err }));

  if (!ctx.emailEnabled || targetUserIds.length === 0) return;
  const { alertWarningDays, alertCriticalDays } = patient.currentStage;
  const slaThresholdDays =
    (severity === "danger" ? alertCriticalDays : alertWarningDays) ?? daysInStage;
  await enqueueEmailDispatch(
    {
      kind: "sla_alert",
      tenantId: ctx.tenantId,
      data: {
        severity,
        patientName: patient.client.name,
        stageName: patient.currentStage.name,
        daysInStage,
        slaThresholdDays,
        clientId: patient.clientId,
        targetUserIds,
        clinicName: ctx.clinicName,
      },
    },
    { jobId: `email|${ctx.tenantId}|${dedupeKey}`.replace(/:/g, "_") },
  ).catch((err) => logger.error("[email] sla alert enqueue failed", { tenantId: ctx.tenantId, err }));
}

/**
 * Checks all patients in a pathway version for SLA warning/critical status
 * and emits deduplicated notifications (once per level per stage entry: patientPathway+stage+enteredStageAt+level).
 */
export async function checkAndEmitSlaNotifications(input: SlaCheckInput): Promise<void> {
  const now = new Date();

  const tenantRow = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { name: true, notifyCriticalAlerts: true },
  });
  if (!tenantRow) return;

  const candidates = toSlaCandidates(await loadSlaPatients(input), now);
  if (candidates.length === 0) return;

  const alerted = await findAlreadyAlertedKeys(input.tenantId, candidates);

  // Destinatários dependem só do tipo e do responsável da etapa: resolve uma vez por combinação.
  const targetsByScope = new Map<string, Promise<string[]>>();
  const ctx: SlaAlertContext = {
    tenantId: input.tenantId,
    clinicName: tenantRow.name?.trim() || "Clínica",
    emailEnabled: tenantRow.notifyCriticalAlerts,
    resolveTargets: ({ notifType, patient }) => {
      const scope = `${notifType}|${patient.currentStageAssigneeUserId ?? ""}`;
      let targets = targetsByScope.get(scope);
      if (!targets) {
        targets = resolvePathwayNotificationTargetUserIds({
          tenantId: input.tenantId,
          type: notifType,
          currentStageAssigneeUserId: patient.currentStageAssigneeUserId,
        });
        targetsByScope.set(scope, targets);
      }
      return targets;
    },
  };

  for (const candidate of candidates) {
    if (alerted.has(candidate.dedupeKey)) continue;
    await emitSlaAlert(ctx, candidate);
  }
}

export type SlaSweepSummary = {
  pathways: number;
  failed: number;
  /** true se o orçamento de tempo acabou antes de varrer todas as jornadas. */
  truncated: boolean;
};

const MAX_PATHWAYS_PER_SWEEP = 2000;

/**
 * Varre a versão publicada mais recente de cada jornada de tenants ativos (sequencial, com orçamento de tempo).
 * Usado pelo cron: o check deixa de depender de alguém abrir o dashboard.
 */
export async function runSlaCheckForActiveTenants(options: {
  budgetMs: number;
  now?: Date;
}): Promise<SlaSweepSummary> {
  const deadline = Date.now() + options.budgetMs;

  const versions = await prisma.pathwayVersion.findMany({
    where: { published: true, pathway: { tenant: { isActive: true } } },
    orderBy: [{ pathwayId: "asc" }, { version: "desc" }],
    select: { id: true, pathwayId: true, pathway: { select: { tenantId: true } } },
    take: MAX_PATHWAYS_PER_SWEEP,
  });

  const latestByPathway = new Map<string, (typeof versions)[number]>();
  for (const v of versions) {
    if (!latestByPathway.has(v.pathwayId)) latestByPathway.set(v.pathwayId, v);
  }

  let processed = 0;
  let failed = 0;
  let truncated = false;
  // Ponto de partida varia por dia: se o orçamento estourar, não são sempre as mesmas jornadas sem checagem.
  for (const v of rotateForDailySweep([...latestByPathway.values()], options.now ?? new Date())) {
    if (Date.now() >= deadline) {
      truncated = true;
      break;
    }
    try {
      await checkAndEmitSlaNotifications({
        tenantId: v.pathway.tenantId,
        pathwayId: v.pathwayId,
        versionId: v.id,
      });
      processed += 1;
    } catch (err) {
      failed += 1;
      logger.error("[sla-sweep] pathway check failed", { pathwayId: v.pathwayId, err });
    }
  }

  return { pathways: processed, failed, truncated };
}

import { beforeEach, describe, expect, it, vi } from "vitest";

type NotificationRow = {
  tenantId: string;
  userId: string;
  type: string;
  dedupeKey: string | null;
  metadata: unknown;
  createdAt: Date;
};

const NOW = new Date("2026-11-20T11:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

const db = vi.hoisted(() => ({
  notifications: [] as NotificationRow[],
  dispatchKeys: new Set<string>(),
  patients: [] as unknown[],
  findManyCalls: 0,
}));
const mocks = vi.hoisted(() => ({
  processEmail: vi.fn(),
  targets: vi.fn(),
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn(async () => ({
        name: "Clínica Sorriso",
        notifyCriticalAlerts: true,
        notifyNewPatients: true,
        notifyDocumentDelivery: true,
      })),
    },
    patientPathway: { findMany: vi.fn(async () => db.patients) },
    notification: {
      findMany: vi.fn(async ({ where }: { where: { dedupeKey?: { in: string[] } | null } }) => {
        db.findManyCalls += 1;
        if (where.dedupeKey && typeof where.dedupeKey === "object") {
          const keys = where.dedupeKey.in;
          return db.notifications.filter((n) => n.dedupeKey && keys.includes(n.dedupeKey));
        }
        return db.notifications.filter((n) => n.dedupeKey === null);
      }),
      createMany: vi.fn(async ({ data }: { data: NotificationRow[] }) => {
        let count = 0;
        for (const row of data) {
          const duplicate =
            row.dedupeKey !== null &&
            db.notifications.some((n) => n.userId === row.userId && n.dedupeKey === row.dedupeKey);
          if (duplicate) continue;
          db.notifications.push({ ...row, createdAt: new Date() });
          count += 1;
        }
        return { count };
      }),
    },
    dispatchKey: {
      createMany: vi.fn(async ({ data }: { data: { key: string }[] }) => {
        let count = 0;
        for (const { key } of data) {
          if (!db.dispatchKeys.has(key)) {
            db.dispatchKeys.add(key);
            count += 1;
          }
        }
        return { count };
      }),
      deleteMany: vi.fn(async ({ where }: { where: { key: string } }) => {
        db.dispatchKeys.delete(where.key);
        return { count: 1 };
      }),
    },
  },
}));
vi.mock("@/infrastructure/notifications/resolve-notification-targets", () => ({
  resolvePathwayNotificationTargetUserIds: mocks.targets,
}));
vi.mock("@/infrastructure/visibility/client-visibility-scope", () => ({
  filterUserIdsWhoCanViewClient: vi.fn(async (_t: string, _c: string, ids: string[]) => ids),
}));
vi.mock("@/infrastructure/queue/redis-connection", () => ({
  isQueueConsumerAvailable: () => false,
  tripRedisCircuit: vi.fn(),
}));
vi.mock("@/infrastructure/email/email-availability", () => ({ canSendEmailForTenant: async () => true }));
vi.mock("@/infrastructure/email/email-dispatch-processor", () => ({ processEmailDispatchJob: mocks.processEmail }));
vi.mock("@/lib/observability/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { checkAndEmitSlaNotifications, runSlaCheckForActiveTenants } = await import("./sla-notification-check");
const { buildSlaDedupeKey } = await import("./sla-dedupe-key");

const input = { tenantId: "t1", pathwayId: "p1", versionId: "v1" };

function patient(id: string, daysInStage: number, stage = { warn: 5, crit: 10 }) {
  return {
    id,
    clientId: `client-${id}`,
    enteredStageAt: new Date(NOW.getTime() - daysInStage * DAY),
    currentStageAssigneeUserId: "u1",
    client: { name: `Paciente ${id}` },
    currentStage: { id: "stage-1", name: "Pré-operatório", alertWarningDays: stage.warn, alertCriticalDays: stage.crit },
  };
}

describe("checkAndEmitSlaNotifications", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    db.notifications = [];
    db.dispatchKeys.clear();
    db.patients = [];
    db.findManyCalls = 0;
    mocks.processEmail.mockReset().mockResolvedValue(undefined);
    mocks.targets.mockReset().mockResolvedValue(["u1", "u2"]);
  });

  it("should create one notification per recipient and one staff email on the first run", async () => {
    db.patients = [patient("pp1", 12)];

    await checkAndEmitSlaNotifications(input);

    expect(db.notifications).toHaveLength(2);
    expect(db.notifications.map((n) => n.type)).toEqual(["sla_critical", "sla_critical"]);
    expect(db.notifications.every((n) => n.dedupeKey?.startsWith("sla|pp1|stage-1|"))).toBe(true);
    expect(mocks.processEmail).toHaveBeenCalledTimes(1);
    expect(mocks.processEmail.mock.calls[0]![0]).toMatchObject({
      kind: "sla_alert",
      data: { severity: "danger", clientId: "client-pp1", targetUserIds: ["u1", "u2"] },
    });
  });

  it("should not notify or email again on a second sequential run", async () => {
    db.patients = [patient("pp1", 12)];

    await checkAndEmitSlaNotifications(input);
    await checkAndEmitSlaNotifications(input);

    expect(db.notifications).toHaveLength(2);
    expect(mocks.processEmail).toHaveBeenCalledTimes(1);
  });

  it("should still dedupe atomically when two runs overlap and both miss the in-memory pre-check", async () => {
    db.patients = [patient("pp1", 12)];

    await Promise.all([checkAndEmitSlaNotifications(input), checkAndEmitSlaNotifications(input)]);

    expect(db.findManyCalls).toBe(4); // as duas execuções passaram pela pré-checagem (2 consultas cada)
    expect(db.notifications).toHaveLength(2); // unique (userId, dedupeKey) descartou a duplicata
    expect(mocks.processEmail).toHaveBeenCalledTimes(1); // DispatchKey do jobId reservou só uma vez
  });

  it("should alert once per level: warning first, then critical when the stage ages further", async () => {
    db.patients = [patient("pp1", 6)];
    await checkAndEmitSlaNotifications(input);
    expect(db.notifications.map((n) => n.type)).toEqual(["sla_warning", "sla_warning"]);

    db.patients = [patient("pp1", 11)];
    await checkAndEmitSlaNotifications(input);

    expect(db.notifications.map((n) => n.type).sort()).toEqual([
      "sla_critical",
      "sla_critical",
      "sla_warning",
      "sla_warning",
    ]);
    expect(mocks.processEmail).toHaveBeenCalledTimes(2);
  });

  it("should load existing keys in batch instead of one query per patient", async () => {
    db.patients = Array.from({ length: 20 }, (_, i) => patient(`pp${i}`, 12));

    await checkAndEmitSlaNotifications(input);

    // 1 consulta de chaves + 1 de legado, independentemente do número de pacientes.
    expect(db.findManyCalls).toBe(2);
  });

  it("should skip patients still within SLA without touching notifications", async () => {
    db.patients = [patient("pp1", 2)];

    await checkAndEmitSlaNotifications(input);

    expect(db.notifications).toHaveLength(0);
    expect(db.findManyCalls).toBe(0);
    expect(mocks.processEmail).not.toHaveBeenCalled();
  });

  it("should respect alerts created before the dedupeKey column existed (metadata key and pre-key legacy rows)", async () => {
    const entered = patient("pp1", 12).enteredStageAt;
    const legacyKey = buildSlaDedupeKey({
      patientPathwayId: "pp1",
      stageId: "stage-1",
      enteredStageAt: entered,
      level: "critical",
    });
    db.patients = [patient("pp1", 12), patient("pp2", 12)];
    db.notifications = [
      // Chave só no metadata (versão anterior do dedupe).
      { tenantId: "t1", userId: "u1", type: "sla_critical", dedupeKey: null, metadata: { slaDedupeKey: legacyKey }, createdAt: new Date(NOW.getTime() - DAY) },
      // Sem chave nenhuma: "já alertou desde que entrou na etapa".
      { tenantId: "t1", userId: "u1", type: "sla_critical", dedupeKey: null, metadata: { patientPathwayId: "pp2" }, createdAt: new Date(NOW.getTime() - DAY) },
    ];

    await checkAndEmitSlaNotifications(input);

    expect(db.notifications).toHaveLength(2);
    expect(mocks.processEmail).not.toHaveBeenCalled();
  });

  it("should resolve recipients once per type and assignee, not once per patient", async () => {
    db.patients = Array.from({ length: 5 }, (_, i) => patient(`pp${i}`, 12));

    await checkAndEmitSlaNotifications(input);

    expect(mocks.targets).toHaveBeenCalledTimes(1);
  });
});

describe("runSlaCheckForActiveTenants", () => {
  it("should report a truncated sweep when the time budget is already exhausted", async () => {
    vi.useRealTimers();
    const { prisma } = await import("@/infrastructure/database/prisma");
    (prisma as unknown as { pathwayVersion: unknown }).pathwayVersion = {
      findMany: vi.fn(async () => [
        { id: "v1", pathwayId: "p1", pathway: { tenantId: "t1" } },
        { id: "v2", pathwayId: "p2", pathway: { tenantId: "t1" } },
      ]),
    };

    const summary = await runSlaCheckForActiveTenants({ budgetMs: 0 });

    expect(summary).toEqual({ pathways: 0, failed: 0, truncated: true });
  });
});

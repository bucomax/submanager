import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ dispatchKeys: new Set<string>() }));
const mocks = vi.hoisted(() => ({
  processEmail: vi.fn(),
  summary: vi.fn(),
  tenants: vi.fn(),
  events: vi.fn(),
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    tenant: { findMany: mocks.tenants },
    tenantMembership: {
      findMany: vi.fn(async ({ where }: { where: { userId?: { in: string[] }; role?: string } }) =>
        where.role === "tenant_admin"
          ? [{ userId: "admin-1" }, { userId: "admin-2" }]
          : (where.userId?.in ?? []).map((userId) => ({ userId })),
      ),
    },
    agendaEvent: { findMany: mocks.events },
    patientPathway: { findFirst: vi.fn(async () => null) },
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
vi.mock("@/application/use-cases/report/generate-pathway-summary", () => ({
  generatePathwaySummary: mocks.summary,
}));
vi.mock("@/infrastructure/email/email-availability", () => ({ canSendEmailForTenant: async () => true }));
vi.mock("@/infrastructure/queue/redis-connection", () => ({
  isQueueConsumerAvailable: () => false,
  tripRedisCircuit: vi.fn(),
}));
vi.mock("@/infrastructure/email/email-dispatch-processor", () => ({ processEmailDispatchJob: mocks.processEmail }));
vi.mock("@/lib/observability/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { runWeeklyReportSweep } = await import("./weekly-report-sweep");
const { runSurgeryReminderSweep } = await import("./surgery-reminder-sweep");

// Segunda 08h em Brasília.
const MONDAY = new Date("2026-11-23T11:00:00Z");

const summaryResult = {
  kpis: { patientsInScope: 4, transitionsInPeriod: 9, criticalPatients: 1, pathwaysInScope: 1 },
  byStatus: [{ status: "ok", count: 3 }, { status: "danger", count: 1 }],
  byStage: [{ id: "s1", label: "Pré-operatório", count: 4 }],
  criticalPatients: { data: [], pagination: { totalItems: 0 } },
};

describe("runWeeklyReportSweep", () => {
  beforeEach(() => {
    db.dispatchKeys.clear();
    mocks.processEmail.mockReset().mockResolvedValue(undefined);
    mocks.summary.mockReset().mockResolvedValue(summaryResult);
    mocks.tenants.mockReset().mockResolvedValue([{ id: "t1", name: "Clínica" }]);
  });

  it("should summarize the same closed Monday-Sunday week it labels, in the clinic timezone", async () => {
    await runWeeklyReportSweep({ budgetMs: 60_000, now: MONDAY });

    const { period } = mocks.summary.mock.calls[0]![0];
    expect(period.start.toISOString()).toBe("2026-11-16T03:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-11-23T03:00:00.000Z");
    expect(mocks.processEmail.mock.calls[0]![0].data.periodLabel).toBe("16 a 22 de novembro");
  });

  it("should send once per tenant and week even if the cron runs twice", async () => {
    const first = await runWeeklyReportSweep({ budgetMs: 60_000, now: MONDAY });
    const second = await runWeeklyReportSweep({ budgetMs: 60_000, now: MONDAY });

    expect(first.enqueued).toBe(1);
    expect(second.failed).toBe(0);
    expect(mocks.processEmail).toHaveBeenCalledTimes(1);
  });

  it("should send again the following week", async () => {
    await runWeeklyReportSweep({ budgetMs: 60_000, now: MONDAY });
    await runWeeklyReportSweep({ budgetMs: 60_000, now: new Date("2026-11-30T11:00:00Z") });

    expect(mocks.processEmail).toHaveBeenCalledTimes(2);
  });
});

describe("runSurgeryReminderSweep", () => {
  const event = {
    id: "ev1",
    tenantId: "t1",
    title: "Cirurgia Maria",
    startsAt: new Date("2026-11-21T12:00:00Z"),
    durationMin: 120,
    notes: null,
    ownerUserId: "u1",
    clientId: null,
    tenant: { name: "Clínica" },
    client: null,
  };

  beforeEach(() => {
    db.dispatchKeys.clear();
    mocks.processEmail.mockReset().mockResolvedValue(undefined);
    mocks.events.mockReset().mockResolvedValue([event]);
  });

  const friday = new Date("2026-11-20T21:00:00Z");

  it("should remind once per event and day even if the cron runs twice", async () => {
    await runSurgeryReminderSweep({ budgetMs: 60_000, now: friday });
    await runSurgeryReminderSweep({ budgetMs: 60_000, now: friday });

    expect(mocks.processEmail).toHaveBeenCalledTimes(1);
  });

  it("should remind again for the same event on a different day", async () => {
    await runSurgeryReminderSweep({ budgetMs: 60_000, now: friday });
    await runSurgeryReminderSweep({ budgetMs: 60_000, now: new Date("2026-11-19T21:00:00Z") });

    expect(mocks.processEmail).toHaveBeenCalledTimes(2);
  });
});

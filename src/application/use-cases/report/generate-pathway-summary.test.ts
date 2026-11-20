import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchScanData: vi.fn() }));

vi.mock("@/infrastructure/repositories/pathway-summary-report.repository", () => ({
  pathwaySummaryReportPrismaRepository: { fetchScanData: mocks.fetchScanData },
}));
vi.mock("@/application/use-cases/shared/load-client-visibility-scope", () => ({
  buildClientVisibilityWhereInput: () => ({}),
}));

const { generatePathwaySummary } = await import("./generate-pathway-summary");
const { SUPER_ADMIN_CLIENT_SCOPE } = await import("@/domain/client/client-visibility");

const NOW = new Date("2026-11-23T11:00:00Z");
const base = {
  tenantId: "t1",
  periodDays: 7,
  page: 1,
  limit: 5,
  scope: SUPER_ADMIN_CLIENT_SCOPE,
  viewerUserId: "u1",
};

describe("generatePathwaySummary period", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    mocks.fetchScanData.mockReset().mockResolvedValue({ rows: [], transitionsInPeriod: 0 });
  });
  afterEach(() => vi.useRealTimers());

  it("should keep the rolling 'now - periodDays' window and an open end when no explicit period is given", async () => {
    const summary = await generatePathwaySummary(base);

    const call = mocks.fetchScanData.mock.calls[0]![0];
    expect(call.periodStart).toEqual(new Date("2026-11-16T11:00:00Z"));
    expect(call.periodEnd).toBeUndefined();
    expect(summary.filters.periodDays).toBe(7);
  });

  it("should query exactly the explicit [start, end) period, ignoring periodDays", async () => {
    const period = { start: new Date("2026-11-16T03:00:00Z"), end: new Date("2026-11-23T03:00:00Z") };

    await generatePathwaySummary({ ...base, periodDays: 30, period });

    const call = mocks.fetchScanData.mock.calls[0]![0];
    expect(call.periodStart).toEqual(period.start);
    expect(call.periodEnd).toEqual(period.end);
  });
});

import { describe, expect, it, vi } from "vitest";

import type { IDashboardHomeRepository } from "@/application/ports/dashboard-home-repository.port";

vi.mock("@/application/use-cases/shared/load-client-visibility-scope", () => ({
  loadTenantMembershipClientScope: async () => ({
    role: "tenant_user",
    restrictedToAssignedOnly: true,
    linkedOpmeSupplierId: "opme-1",
  }),
  buildClientVisibilityFlatFilter: (_s: unknown, viewer: string) => ({
    opmeSupplierId: "opme-1",
    assignedToUserId: viewer,
  }),
}));

const { getDashboardHomeMetrics } = await import("./get-dashboard-home-metrics");

describe("getDashboardHomeMetrics", () => {
  it("should pass the viewer visibility filter to every aggregation", async () => {
    const calls: unknown[] = [];
    const track = <T>(value: T) => async (...args: unknown[]): Promise<T> => {
      calls.push(args[args.length - 1]);
      return value;
    };
    const repo: IDashboardHomeRepository = {
      fetchPathwayOptions: async () => [],
      countActivePathways: track(0),
      countTransitionsSince: track(0),
      countAwaitingAction: track(0),
      countCompletedSince: track(0),
      countTransitionsByDay: track([]),
      countPathwaysWithTransitionSince: track(0),
      countCompletionsByDay: track([]),
      countStartsByDay: track([]),
    };

    await getDashboardHomeMetrics("t1", repo, { userId: "u1", globalRole: "user" });

    expect(calls).toHaveLength(8);
    for (const visibility of calls) {
      expect(visibility).toEqual({ opmeSupplierId: "opme-1", assignedToUserId: "u1" });
    }
  });
});

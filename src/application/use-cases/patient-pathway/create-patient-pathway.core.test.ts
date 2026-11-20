import type { Actor } from "@/domain/auth/actor";
import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryPatientPathwayStartStore } from "@/application/testing/in-memory-patient-pathway-start-store";
import {
  FakeNotificationEmitter,
  FakeNotificationTargetResolver,
  FakeWhatsAppQueue,
} from "@/application/testing/fake-notifications";
import { FakeTenantListCache } from "@/application/testing/in-memory-unit-of-work";
import {
  createPatientPathway,
  type CreatePatientPathwayDeps,
} from "@/application/use-cases/patient-pathway/create-patient-pathway.core";

const TENANT = "tenant-1";
const ACTOR = "user-actor";
const actor: Actor = { userId: ACTOR, globalRole: "user", tenantId: TENANT, tenantRole: "tenant_user" };

function setup() {
  const store = new InMemoryPatientPathwayStartStore();
  const cache = new FakeTenantListCache();
  const notifications = new FakeNotificationEmitter();
  const whatsappQueue = new FakeWhatsAppQueue();
  const visibleClients = new Map([["c1", { id: "c1", assignedToUserId: "user-owner" }]]);
  const deps: CreatePatientPathwayDeps = {
    store,
    clients: { findVisibleClient: async (_s, _t, clientId) => visibleClients.get(clientId) ?? null },
    cache,
    notificationTargets: new FakeNotificationTargetResolver(["user-staff"]),
    notifications,
    whatsappQueue,
  };
  store.state.carePathways = [{ id: "p1", tenantId: TENANT, name: "Cirurgia" }];
  store.state.clients = { c1: { id: "c1", name: "Maria", phone: "11999999999" } };
  store.state.members = [`${TENANT}:user-owner`];
  const stage = (id: string, sortOrder: number, defaults: string[] = []) => ({
    id, name: `Etapa ${id}`, stageKey: id, sortOrder, patientMessage: null, alertWarningDays: null,
    alertCriticalDays: null, defaultAssigneeUserId: defaults[0] ?? null, defaultAssigneeUserIds: defaults,
  });
  store.state.publishedVersions = [{ pathwayId: "p1", version: 1, id: "v1", stages: [stage("s1", 0), stage("s2", 1)] }];
  const run = (overrides: Partial<{ clientId: string; pathwayId: string }> = {}) =>
    createPatientPathway(
      { tenantId: TENANT, actorUserId: ACTOR, actor, clientId: "c1", pathwayId: "p1", ...overrides },
      deps,
    );
  return { store, cache, notifications, whatsappQueue, visibleClients, run, stage };
}

describe("createPatientPathway", () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it("should start the pathway at the first stage with transition, audit and client assignee fallback", async () => {
    const result = await ctx.run();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.patientPathway).toMatchObject({
      client: { id: "c1" },
      pathway: { id: "p1" },
      currentStage: { id: "s1" },
      currentStageAssignee: { id: "user-owner" },
    });
    const { state } = ctx.store;
    expect(state.patientPathways).toHaveLength(1);
    expect(state.transitions).toMatchObject([{ toStageId: "s1", actorUserId: ACTOR }]);
    expect(state.audits).toMatchObject([{ type: "PATIENT_PATHWAY_STARTED", clientId: "c1" }]);
    expect(state.locks).toEqual(["c1"]);
    expect(state.pathwayLocks).toEqual(["p1"]);
    expect(ctx.cache.clientsListRevalidated).toEqual([TENANT]);
  });

  it("should start on the version published when the transaction runs, not the one read before it", async () => {
    // Um publish conclui entre a validação inicial e a transação.
    ctx.store.beforeTransaction = () => {
      ctx.store.state.publishedVersions = [
        { pathwayId: "p1", version: 2, id: "v2", stages: [ctx.stage("s9", 0)] },
      ];
    };

    const result = await ctx.run();

    expect(result.ok && result.data.patientPathway.currentStage.id).toBe("s9");
    expect(ctx.store.state.transitions).toMatchObject([{ toStageId: "s9" }]);
    expect(ctx.store.state.pathwayLocks).toEqual(["p1"]);
  });

  it("should reject when the version is unpublished between the quick check and the transaction", async () => {
    ctx.store.beforeTransaction = () => {
      ctx.store.state.publishedVersions = [];
    };

    expect(await ctx.run()).toEqual({ ok: false, code: "NO_PUBLISHED_VERSION" });
    expect(ctx.store.state.patientPathways).toHaveLength(0);
    expect(ctx.store.state.transitions).toHaveLength(0);
    expect(ctx.store.state.audits).toHaveLength(0);
  });

  it("should reject a second active pathway for the same client", async () => {
    await ctx.run();

    expect(await ctx.run()).toEqual({ ok: false, code: "ACTIVE_PATHWAY_EXISTS" });
    expect(ctx.store.state.patientPathways).toHaveLength(1);
  });

  it("should reject when another request created the pathway between the quick check and the transaction", async () => {
    ctx.store.beforeTransaction = () => {
      ctx.store.state.patientPathways.push({ id: "pp-race", clientId: "c1", completedAt: null, row: {} as never });
    };

    expect(await ctx.run()).toEqual({ ok: false, code: "ACTIVE_PATHWAY_EXISTS" });
    expect(ctx.store.state.transitions).toHaveLength(0);
    expect(ctx.store.state.audits).toHaveLength(0);
  });

  it("should allow a new pathway when the previous one is completed", async () => {
    ctx.store.state.patientPathways.push({ id: "old", clientId: "c1", completedAt: new Date(), row: {} as never });
    expect((await ctx.run()).ok).toBe(true);
  });

  it("should respond not found for clients outside the actor's visibility", async () => {
    expect(await ctx.run({ clientId: "hidden" })).toEqual({ ok: false, code: "CLIENT_NOT_FOUND" });
  });

  it("should reject unknown pathways and pathways without a published version or stages", async () => {
    expect(await ctx.run({ pathwayId: "nope" })).toEqual({ ok: false, code: "PATHWAY_NOT_FOUND" });

    ctx.store.state.publishedVersions = [];
    expect(await ctx.run()).toEqual({ ok: false, code: "NO_PUBLISHED_VERSION" });

    ctx.store.state.publishedVersions = [{ pathwayId: "p1", version: 1, id: "v1", stages: [] }];
    expect(await ctx.run()).toEqual({ ok: false, code: "NO_PUBLISHED_VERSION" });
  });

  it("should use the stage default assignee when it is a tenant member", async () => {
    ctx.store.state.members.push(`${TENANT}:user-default`);
    ctx.store.state.publishedVersions[0]!.stages = [ctx.stage("s1", 0, ["user-default"])];

    const result = await ctx.run();

    expect(result.ok && result.data.patientPathway.currentStageAssignee?.id).toBe("user-default");
  });

  it("should notify staff and enqueue the stage documents on WhatsApp after commit", async () => {
    ctx.store.state.documentsByStage.s1 = [
      { stageDocumentId: "sd1", sortOrder: 0, file: { id: "f1", fileName: "a.pdf", mimeType: "application/pdf", r2Key: "k1" } },
    ];
    const result = await ctx.run();
    if (!result.ok) throw new Error("expected ok");

    await result.afterCommit();

    expect(ctx.notifications.emitted[0]).toMatchObject({ type: "new_patient", targetUserIds: ["user-staff"] });
    expect(ctx.whatsappQueue.enqueued[0]).toMatchObject({
      recipientPhone: "11999999999",
      documents: [{ fileName: "a.pdf", r2Key: "k1" }],
    });
  });

  it("should not enqueue WhatsApp when the first stage has no documents", async () => {
    const result = await ctx.run();
    if (!result.ok) throw new Error("expected ok");

    await result.afterCommit();

    expect(ctx.whatsappQueue.enqueued).toHaveLength(0);
  });
});

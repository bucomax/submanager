import { beforeEach, describe, expect, it } from "vitest";

import {
  FakeDistributedLock,
  FakeTenantListCache,
} from "@/application/testing/in-memory-unit-of-work";
import { createFakePostCommitDeps } from "@/application/testing/fake-notifications";
import { InMemoryStageTransitionStore } from "@/application/testing/in-memory-stage-transition-store";
import {
  transitionPatientStage,
  type StageTransitionInput,
  type TransitionPatientStageDeps,
  type TransitionPatientStageParams,
} from "@/application/use-cases/pathway/transition-patient-stage.core";

const TENANT = "tenant-1";
const ACTOR = "user-actor";
const PP = "pp-1";

function setup() {
  const store = new InMemoryStageTransitionStore();
  const lock = new FakeDistributedLock();
  const cache = new FakeTenantListCache();
  const postCommit = createFakePostCommitDeps();
  const stage = (id: string, name: string, pathwayVersionId = "v1") => ({
    id,
    name,
    pathwayVersionId,
    patientMessage: null,
    defaultAssigneeUserIds: [],
    defaultAssigneeUserId: null,
  });
  store.state.stages = {
    s1: stage("s1", "Triagem"),
    s2: stage("s2", "Cirurgia"),
    s3: stage("s3", "Pós"),
    "s-other": stage("s-other", "Outra versão", "v2"),
  };
  store.state.clients = {
    c1: {
      id: "c1",
      name: "Maria",
      email: "maria@x.com",
      phone: "11999999999",
      assignedToUserId: "user-owner",
      opmeSupplierId: null,
    },
  };
  store.state.patientPathways = {
    [PP]: {
      id: PP,
      tenantId: TENANT,
      clientId: "c1",
      pathwayVersionId: "v1",
      currentStageId: "s1",
      completedAt: null,
      enteredStageAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      currentStageAssigneeUserId: null,
    },
  };
  store.state.members = [`${TENANT}:user-owner`, `${TENANT}:user-default`];
  const deps: TransitionPatientStageDeps = {
    store,
    clients: store,
    lock,
    cache,
    postCommit: postCommit.deps,
  };
  const run = (input: Partial<StageTransitionInput> & { toStageId: string }, extra: Partial<TransitionPatientStageParams> = {}) =>
    transitionPatientStage(
      { tenantId: TENANT, actorUserId: ACTOR, patientPathwayId: PP, input: input as StageTransitionInput, ...extra },
      deps,
    );
  return { store, lock, cache, postCommit, run };
}

describe("transitionPatientStage", () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it("should move the patient to a stage of the same version, record transition and audit, and revalidate the list", async () => {
    const result = await ctx.run({ toStageId: "s2", note: "  ok  " });

    expect(result.ok).toBe(true);
    expect(ctx.store.state.patientPathways[PP]!.currentStageId).toBe("s2");
    expect(ctx.store.state.transitions).toHaveLength(1);
    expect(ctx.store.state.transitions[0]).toMatchObject({
      fromStageId: "s1",
      toStageId: "s2",
      actorUserId: ACTOR,
      note: "ok",
      ruleOverrideReason: null,
      forcedByUserId: null,
    });
    expect(ctx.store.state.audits).toMatchObject([
      { type: "STAGE_TRANSITION", payload: { fromStageName: "Triagem", toStageName: "Cirurgia", forcedOverride: false } },
    ]);
    expect(ctx.cache.clientsListRevalidated).toEqual([TENANT]);
    expect(ctx.lock.held.size).toBe(0);
  });

  it("should assign the first tenant member among stage defaults, falling back to the client assignee", async () => {
    ctx.store.state.stages.s2!.defaultAssigneeUserIds = ["user-outsider", "user-default"];
    await ctx.run({ toStageId: "s2" });
    expect(ctx.store.state.patientPathways[PP]!.currentStageAssigneeUserId).toBe("user-default");

    ctx.store.state.stages.s3!.defaultAssigneeUserIds = ["user-outsider"];
    await ctx.run({ toStageId: "s3" });
    expect(ctx.store.state.patientPathways[PP]!.currentStageAssigneeUserId).toBe("user-owner");
  });

  it("should reject a target stage that belongs to another pathway version", async () => {
    const result = await ctx.run({ toStageId: "s-other" });

    expect(result).toEqual({ ok: false, code: "TARGET_STAGE_NOT_FOUND" });
    expect(ctx.store.state.transitions).toHaveLength(0);
  });

  it("should respond as not found when the patient pathway does not exist in the tenant", async () => {
    const result = await ctx.run({ toStageId: "s2" }, { tenantId: "other-tenant" });
    expect(result).toEqual({ ok: false, code: "PATIENT_PATHWAY_NOT_FOUND" });
  });

  it("should hide patients outside the actor visibility scope", async () => {
    const scope = { role: "tenant_user", restrictedToAssignedOnly: true, linkedOpmeSupplierId: null };

    const hidden = await ctx.run({ toStageId: "s2" }, { clientVisibility: { scope, viewerUserId: "someone-else" } });
    const visible = await ctx.run({ toStageId: "s2" }, { clientVisibility: { scope, viewerUserId: "user-owner" } });

    expect(hidden).toEqual({ ok: false, code: "PATIENT_PATHWAY_NOT_FOUND" });
    expect(visible.ok).toBe(true);
  });

  it("should reject transitions on a completed pathway", async () => {
    ctx.store.state.patientPathways[PP]!.completedAt = new Date();
    expect(await ctx.run({ toStageId: "s2" })).toEqual({ ok: false, code: "PATHWAY_ALREADY_COMPLETED" });
  });

  it("should reject a transition to the stage the patient is already in", async () => {
    expect(await ctx.run({ toStageId: "s1" })).toEqual({ ok: false, code: "ALREADY_IN_TARGET_STAGE" });
  });

  describe("required checklist gate", () => {
    beforeEach(() => {
      ctx.store.state.requiredChecklist = [
        { id: "i1", stageId: "s1", label: "Exames", sortOrder: 0 },
        { id: "i2", stageId: "s1", label: "Termo", sortOrder: 1 },
      ];
      ctx.store.state.completedChecklist = [`${PP}:i2`];
    });

    it("should block the transition and persist nothing while required items are pending", async () => {
      const result = await ctx.run({ toStageId: "s2" });

      expect(result).toEqual({ ok: false, code: "CHECKLIST_BLOCKED", pendingItems: [{ id: "i1", label: "Exames" }] });
      expect(ctx.store.state.patientPathways[PP]!.currentStageId).toBe("s1");
      expect(ctx.store.state.transitions).toHaveLength(0);
      expect(ctx.store.state.audits).toHaveLength(0);
    });

    it("should let the transition through with force and record the trimmed override reason and the forcing user", async () => {
      const result = await ctx.run({ toStageId: "s2", force: true, overrideReason: "  cirurgia urgente  " });

      expect(result.ok).toBe(true);
      expect(ctx.store.state.transitions[0]).toMatchObject({
        ruleOverrideReason: "cirurgia urgente",
        forcedByUserId: ACTOR,
      });
      expect(ctx.store.state.audits[0]!.payload).toMatchObject({ forcedOverride: true });
      expect(JSON.stringify(ctx.store.state.audits[0]!.payload)).not.toContain("urgente");
    });

    it.each([undefined, "", "   ", "curto", "         x         "])(
      "should reject force without a sufficient override reason (%j) and persist nothing",
      async (overrideReason) => {
        const result = await ctx.run({ toStageId: "s2", force: true, overrideReason });

        expect(result).toEqual({ ok: false, code: "OVERRIDE_REASON_REQUIRED" });
        expect(ctx.store.state.patientPathways[PP]!.currentStageId).toBe("s1");
        expect(ctx.store.state.transitions).toHaveLength(0);
        expect(ctx.store.state.audits).toHaveLength(0);
      },
    );

    it("should ignore force (and not require a reason) when nothing is pending", async () => {
      ctx.store.state.completedChecklist = [`${PP}:i1`, `${PP}:i2`];

      const result = await ctx.run({ toStageId: "s2", force: true });

      expect(result.ok).toBe(true);
      expect(ctx.store.state.transitions[0]).toMatchObject({ ruleOverrideReason: null, forcedByUserId: null });
    });
  });

  describe("concurrency", () => {
    it("should return LOCK_CONFLICT when another process holds the transition lock", async () => {
      ctx.lock.heldByOthers.add(`lock:transition:${PP}`);
      expect(await ctx.run({ toStageId: "s2" })).toEqual({ ok: false, code: "LOCK_CONFLICT" });
    });

    it("should return STAGE_CONFLICT when the conditional claim loses the race and write nothing", async () => {
      ctx.store.forceClaimConflict = true;

      expect(await ctx.run({ toStageId: "s2" })).toEqual({ ok: false, code: "STAGE_CONFLICT" });
      expect(ctx.store.state.transitions).toHaveLength(0);
      expect(ctx.store.state.audits).toHaveLength(0);
      expect(ctx.lock.held.size).toBe(0);
    });

    it("should return STAGE_CONFLICT when the patient moved to another pathway version after the read", async () => {
      ctx.store.beforeTransaction = () => {
        ctx.store.state.patientPathways[PP]!.pathwayVersionId = "v2";
      };
      expect(await ctx.run({ toStageId: "s2" })).toEqual({ ok: false, code: "STAGE_CONFLICT" });
    });

    it("should return STAGE_CONFLICT when a publish migrates the patient inside the tx, between the state read and the claim", async () => {
      ctx.store.afterStateRead = (draft) => {
        draft.patientPathways[PP]!.pathwayVersionId = "v2";
      };

      expect(await ctx.run({ toStageId: "s2" })).toEqual({ ok: false, code: "STAGE_CONFLICT" });
      expect(ctx.store.state.transitions).toHaveLength(0);
      expect(ctx.store.state.patientPathways[PP]!.currentStageId).toBe("s1");
    });

    it("should return PATHWAY_ALREADY_COMPLETED when the pathway got completed after the read", async () => {
      ctx.store.beforeTransaction = () => {
        ctx.store.state.patientPathways[PP]!.completedAt = new Date();
      };
      expect(await ctx.run({ toStageId: "s2" })).toEqual({ ok: false, code: "PATHWAY_ALREADY_COMPLETED" });
    });

    it("should return the winner's state when a concurrent retry with the same correlationId loses the race", async () => {
      ctx.store.beforeTransaction = () => {
        ctx.store.state.transitions.push({
          id: "winner",
          patientPathwayId: PP,
          fromStageId: "s1",
          toStageId: "s2",
          actorUserId: ACTOR,
          note: null,
          ruleOverrideReason: null,
          forcedByUserId: null,
          correlationId: "corr-1",
          dispatchStub: {},
        });
        ctx.store.state.patientPathways[PP]!.currentStageId = "s2";
        ctx.store.forceClaimConflict = true;
      };

      const result = await ctx.run({ toStageId: "s2", correlationId: "corr-1" });

      expect(result.ok).toBe(true);
      expect(ctx.store.state.transitions).toHaveLength(1);
    });
  });

  describe("idempotent replay by correlationId", () => {
    it("should return the current state without a new transition when the same correlationId is replayed", async () => {
      await ctx.run({ toStageId: "s2", correlationId: "corr-1" });
      const replay = await ctx.run({ toStageId: "s2", correlationId: "corr-1" });

      expect(replay.ok).toBe(true);
      expect(ctx.store.state.transitions).toHaveLength(1);
      if (replay.ok) {
        await replay.afterCommit();
        expect(ctx.postCommit.notifications.emitted).toHaveLength(0);
      }
    });

    it("should return STAGE_CONFLICT when the correlationId was already used for a different target stage", async () => {
      await ctx.run({ toStageId: "s2", correlationId: "corr-1" });

      expect(await ctx.run({ toStageId: "s3", correlationId: "corr-1" })).toEqual({
        ok: false,
        code: "STAGE_CONFLICT",
      });
      expect(ctx.store.state.patientPathways[PP]!.currentStageId).toBe("s2");
    });

    it("should replay even after the pathway was completed", async () => {
      await ctx.run({ toStageId: "s2", correlationId: "corr-1" });
      ctx.store.state.patientPathways[PP]!.completedAt = new Date();

      expect((await ctx.run({ toStageId: "s2", correlationId: "corr-1" })).ok).toBe(true);
    });
  });

  describe("post-commit effects", () => {
    it("should notify staff, enqueue the patient e-mail and WhatsApp with the stage documents", async () => {
      ctx.store.state.documentsByStage.s2 = [
        {
          stageDocumentId: "sd1",
          sortOrder: 0,
          file: { id: "f1", fileName: "orientacoes.pdf", mimeType: "application/pdf", r2Key: "tenants/t/f1" },
        },
      ];
      const result = await ctx.run({ toStageId: "s2" });
      if (!result.ok) throw new Error("expected ok");

      await result.afterCommit();

      const { notifications, emailQueue, whatsappQueue } = ctx.postCommit;
      expect(notifications.emitted).toHaveLength(1);
      expect(notifications.emitted[0]).toMatchObject({ type: "stage_transition", targetUserIds: ["user-staff"] });
      expect(emailQueue.enqueued[0]).toMatchObject({
        to: "maria@x.com",
        data: { portalUrl: "https://app.test/clinica/patient/login", documents: [{ fileName: "orientacoes.pdf" }] },
      });
      expect(whatsappQueue.enqueued[0]).toMatchObject({ recipientPhone: "11999999999", stageName: "Cirurgia" });
      expect(emailQueue.documentDeliveries[0]).toMatchObject({
        candidateUserIds: expect.arrayContaining([ACTOR]),
        stageName: "Cirurgia",
        documents: [{ fileName: "orientacoes.pdf" }],
      });
    });

    it("should skip WhatsApp when the stage has no documents and not block the other channels when one fails", async () => {
      ctx.postCommit.deps.emailQueue.enqueueStageTransitionPatientEmail = async () => {
        throw new Error("smtp down");
      };
      const result = await ctx.run({ toStageId: "s2" });
      if (!result.ok) throw new Error("expected ok");

      await expect(result.afterCommit()).resolves.toBeUndefined();

      expect(ctx.postCommit.whatsappQueue.enqueued).toHaveLength(0);
      expect(ctx.postCommit.emailQueue.documentDeliveries).toHaveLength(0);
      expect(ctx.postCommit.notifications.emitted).toHaveLength(1);
    });
  });
});

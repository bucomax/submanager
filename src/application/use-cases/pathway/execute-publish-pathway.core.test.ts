import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryPathwayPublishStore } from "@/application/testing/in-memory-pathway-publish-store";
import { FakeTenantListCache } from "@/application/testing/in-memory-unit-of-work";
import {
  previewPathwayPublish,
  publishPathwayVersionFlow,
} from "@/application/use-cases/pathway/execute-publish-pathway.core";

const TENANT = "tenant-1";
const PATHWAY = "pathway-1";
const apiT = (key: string) => key;
const USER_OK = "cuser0000000000000000000001";
const USER_OUTSIDER = "cuser0000000000000000000002";
const FILE_A = "cfile0000000000000000000001";
const FILE_B = "cfile0000000000000000000002";
const FILE_OTHER_TENANT = "cfile0000000000000000000009";

type NodeSpec = { id: string; label?: string; checklist?: { label: string; required?: boolean }[]; docs?: string[]; assignees?: string[] };

function graph(nodes: NodeSpec[]) {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      data: {
        label: n.label ?? n.id.toUpperCase(),
        checklistItems: (n.checklist ?? []).map((c, i) => ({
          id: `i${i}`,
          label: c.label,
          requiredForTransition: c.required === true,
        })),
        stageDocuments: (n.docs ?? []).map((fileAssetId) => ({ fileAssetId, fileName: "f.pdf", mimeType: "application/pdf" })),
        defaultAssigneeUserIds: n.assignees ?? [],
      },
    })),
  };
}

function setup() {
  const store = new InMemoryPathwayPublishStore();
  const cache = new FakeTenantListCache();
  store.state.carePathways = [{ id: PATHWAY, tenantId: TENANT }];
  store.state.members = [`${TENANT}:${USER_OK}`];
  store.state.files = [
    { id: FILE_A, tenantId: TENANT },
    { id: FILE_B, tenantId: TENANT },
    { id: FILE_OTHER_TENANT, tenantId: "other-tenant" },
  ];
  const addVersion = (id: string, version: number, published: boolean, nodes: NodeSpec[]) =>
    store.state.versions.push({ id, pathwayId: PATHWAY, version, published, graphJson: graph(nodes) });
  const addStage = (id: string, versionId: string, stageKey: string, sortOrder = 0) =>
    store.state.stages.push({
      id, versionId, stageKey, name: stageKey, sortOrder, patientMessage: null,
      alertWarningDays: null, alertCriticalDays: null, defaultAssigneeUserId: null, defaultAssigneeUserIds: [],
    });
  const publish = (versionId: string) =>
    publishPathwayVersionFlow({ tenantId: TENANT, pathwayId: PATHWAY, versionId, apiT }, { store, cache });
  return { store, cache, addVersion, addStage, publish };
}

describe("publishPathwayVersionFlow", () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it("should publish a first version creating stages, checklist and only the tenant's documents in order", async () => {
    ctx.addVersion("v1", 1, false, [
      { id: "a", checklist: [{ label: "Exames", required: true }], docs: [FILE_B, FILE_OTHER_TENANT, FILE_A, FILE_B], assignees: [USER_OK] },
      { id: "b" },
    ]);

    const result = await ctx.publish("v1");

    expect(result.ok).toBe(true);
    if (!result.ok || !("data" in result)) throw new Error("expected success");
    expect(result.data.version).toMatchObject({ id: "v1", published: true });
    expect(result.data.version.stages.map((s) => s.stageKey)).toEqual(["a", "b"]);
    expect(result.data.version.stages[0]).toMatchObject({ defaultAssigneeUserIds: [USER_OK], defaultAssigneeUserId: USER_OK });
    const { checklistItems, stageDocuments } = ctx.store.state;
    expect(checklistItems).toMatchObject([{ label: "Exames", requiredForTransition: true }]);
    expect(stageDocuments.map((d) => [d.fileAssetId, d.sortOrder])).toEqual([[FILE_B, 0], [FILE_A, 1]]);
    expect(ctx.store.state.locks).toEqual([PATHWAY]);
    expect(ctx.cache.pathwaysAndClientsRevalidated).toEqual([TENANT]);
  });

  it("should keep patient checklist progress and move patients when republishing with the same labels", async () => {
    ctx.addVersion("v1", 1, true, [{ id: "a", checklist: [{ label: "Exames" }, { label: "Termo" }] }]);
    ctx.addVersion("v2", 2, false, [
      { id: "a", checklist: [{ label: "Exames", required: true }, { label: "Termo" }, { label: "Novo" }] },
    ]);
    ctx.addStage("stage-a", "v1", "a");
    ctx.store.state.checklistItems = [
      { id: "item-exames", stageId: "stage-a", label: "Exames", sortOrder: 0, requiredForTransition: false },
      { id: "item-termo", stageId: "stage-a", label: "Termo", sortOrder: 1, requiredForTransition: false },
    ];
    ctx.store.state.patientPathways = [{ id: "pp1", versionId: "v1", currentStageId: "stage-a" }];
    ctx.store.state.checklistProgress = [{ patientPathwayId: "pp1", itemId: "item-exames" }];

    const result = await ctx.publish("v2");

    expect(result.ok).toBe(true);
    const { state } = ctx.store;
    expect(state.checklistProgress).toEqual([{ patientPathwayId: "pp1", itemId: "item-exames" }]);
    expect(state.checklistItems.find((i) => i.id === "item-exames")).toMatchObject({ requiredForTransition: true });
    expect(state.checklistItems.map((i) => i.label).sort()).toEqual(["Exames", "Novo", "Termo"]);
    expect(state.stages).toHaveLength(1);
    expect(state.stages[0]).toMatchObject({ id: "stage-a", versionId: "v2" });
    expect(state.patientPathways[0]).toMatchObject({ versionId: "v2", currentStageId: "stage-a" });
    expect(state.versions.map((v) => [v.id, v.published])).toEqual([["v1", false], ["v2", true]]);
  });

  it("should delete only the progress of checklist items removed from the graph", async () => {
    ctx.addVersion("v1", 1, true, [{ id: "a", checklist: [{ label: "Exames" }, { label: "Termo" }] }]);
    ctx.addVersion("v2", 2, false, [{ id: "a", checklist: [{ label: "Exames" }] }]);
    ctx.addStage("stage-a", "v1", "a");
    ctx.store.state.checklistItems = [
      { id: "item-exames", stageId: "stage-a", label: "Exames", sortOrder: 0, requiredForTransition: false },
      { id: "item-termo", stageId: "stage-a", label: "Termo", sortOrder: 1, requiredForTransition: false },
    ];
    ctx.store.state.checklistProgress = [
      { patientPathwayId: "pp1", itemId: "item-exames" },
      { patientPathwayId: "pp1", itemId: "item-termo" },
    ];

    await ctx.publish("v2");

    expect(ctx.store.state.checklistProgress).toEqual([{ patientPathwayId: "pp1", itemId: "item-exames" }]);
  });

  it("should reject publishing a version that is already published", async () => {
    ctx.addVersion("v1", 1, true, [{ id: "a" }]);

    const result = await ctx.publish("v1");

    expect(result).toEqual({ ok: false, publishConflict: { ok: false, code: "ALREADY_PUBLISHED" } });
    expect(ctx.cache.pathwaysAndClientsRevalidated).toHaveLength(0);
  });

  it("should block removing a stage that still has patients and change nothing", async () => {
    ctx.addVersion("v1", 1, true, [{ id: "a" }, { id: "gone" }]);
    ctx.addVersion("v2", 2, false, [{ id: "a" }]);
    ctx.addStage("stage-a", "v1", "a");
    ctx.addStage("stage-gone", "v1", "gone", 1);
    ctx.store.state.patientPathways = [{ id: "pp1", versionId: "v1", currentStageId: "stage-gone" }];
    const before = structuredClone(ctx.store.state);

    const result = await ctx.publish("v2");

    expect(result).toMatchObject({
      ok: false,
      preflightHttp: { status: 409, errorCode: "CONFLICT", details: { stages: [{ stageKey: "gone", patientCount: 1 }] } },
    });
    expect(ctx.store.state).toEqual(before);
  });

  it("should enforce the removed-stage-with-patients rule inside the transaction too", async () => {
    ctx.addVersion("v1", 1, true, [{ id: "gone" }]);
    ctx.addVersion("v2", 2, false, [{ id: "a" }]);
    ctx.addStage("stage-gone", "v1", "gone");
    ctx.store.state.patientPathways = [{ id: "pp1", versionId: "v1", currentStageId: "stage-gone" }];
    const { runPublishPathwayVersionTransaction } = await import(
      "@/application/use-cases/pathway/publish-pathway-version-transaction"
    );

    const result = await ctx.store.runInTransaction((tx) =>
      runPublishPathwayVersionTransaction(tx, { tenantId: TENANT, pathwayId: PATHWAY, versionId: "v2", stages: [] }),
    );

    expect(result).toEqual({
      ok: false,
      code: "REMOVED_STAGES_WITH_PATIENTS",
      stages: [{ stageKey: "gone", name: "gone", patientCount: 1 }],
    });
    expect(ctx.store.state.stages).toHaveLength(1);
    expect(ctx.store.state.versions.find((v) => v.id === "v2")!.published).toBe(false);
  });

  it("should keep removed stages without patients, with their transition history, in the previous version", async () => {
    ctx.addVersion("v1", 1, true, [{ id: "a" }, { id: "retired" }]);
    ctx.addVersion("v2", 2, false, [{ id: "a" }]);
    ctx.addStage("stage-a", "v1", "a");
    ctx.addStage("stage-retired", "v1", "retired", 1);
    ctx.store.state.transitions = [{ id: "t1", fromStageId: "stage-retired", toStageId: "stage-a" }];

    const result = await ctx.publish("v2");

    expect(result.ok).toBe(true);
    const { state } = ctx.store;
    expect(state.stages.find((s) => s.id === "stage-retired")).toMatchObject({ versionId: "v1" });
    expect(state.transitions).toHaveLength(1);
  });

  it("should move own stages with history to the published version instead of deleting them when republishing an old version", async () => {
    ctx.addVersion("v1", 1, false, [{ id: "b" }]);
    ctx.addVersion("v2", 2, true, [{ id: "c" }]);
    ctx.addStage("stage-b", "v1", "b");
    ctx.addStage("stage-old", "v1", "old", 1);
    ctx.addStage("stage-c", "v2", "c");
    ctx.store.state.transitions = [{ id: "t1", fromStageId: null, toStageId: "stage-old" }];

    const result = await ctx.publish("v1");

    expect(result.ok).toBe(true);
    const { state } = ctx.store;
    expect(state.stages.find((s) => s.id === "stage-old")).toMatchObject({ versionId: "v2" });
    expect(state.stages.find((s) => s.id === "stage-b")).toMatchObject({ versionId: "v1" });
    expect(state.transitions).toHaveLength(1);
  });

  it("should report STAGE_KEY_CONFLICT when an own stage with history clashes with a published stage key", async () => {
    ctx.addVersion("v1", 1, false, [{ id: "a" }]);
    ctx.addVersion("v2", 2, true, [{ id: "a" }]);
    ctx.addStage("own-a", "v1", "a");
    ctx.addStage("pub-a", "v2", "a");
    ctx.store.state.transitions = [{ id: "t1", fromStageId: null, toStageId: "own-a" }];

    const result = await ctx.publish("v1");

    expect(result).toEqual({ ok: false, publishConflict: { ok: false, code: "STAGE_KEY_CONFLICT" } });
  });

  it("should roll back earlier deletes and leave no partial state when STAGE_KEY_CONFLICT aborts the publish", async () => {
    ctx.addVersion("v1", 1, false, [{ id: "a" }]);
    ctx.addVersion("v2", 2, true, [{ id: "a" }]);
    ctx.addStage("own-removable", "v1", "removable");
    ctx.addStage("own-a", "v1", "a");
    ctx.addStage("pub-a", "v2", "a");
    ctx.store.state.transitions = [{ id: "t1", fromStageId: null, toStageId: "own-a" }];
    const before = structuredClone(ctx.store.state);

    const result = await ctx.publish("v1");

    expect(result).toEqual({ ok: false, publishConflict: { ok: false, code: "STAGE_KEY_CONFLICT" } });
    expect(ctx.store.state).toEqual(before);
    expect(ctx.store.state.stages.map((s) => s.id)).toContain("own-removable");
    expect(ctx.cache.pathwaysAndClientsRevalidated).toEqual([]);
  });

  it("should not touch other tenants: unknown pathway or version are reported as not found", async () => {
    ctx.addVersion("v1", 1, false, [{ id: "a" }]);

    expect(
      await publishPathwayVersionFlow({ tenantId: "other", pathwayId: PATHWAY, versionId: "v1", apiT }, ctx),
    ).toEqual({ ok: false, code: "PATHWAY_NOT_FOUND" });
    expect(await ctx.publish("missing")).toEqual({ ok: false, code: "VERSION_NOT_FOUND" });
  });

  it("should reject an empty graph and assignees outside the tenant with 422", async () => {
    ctx.addVersion("v1", 1, false, []);
    ctx.addVersion("v2", 2, false, [{ id: "a", assignees: [USER_OUTSIDER] }]);

    expect(await ctx.publish("v1")).toMatchObject({ ok: false, preflightHttp: { status: 422, message: "errors.graphNeedsAtLeastOneNode" } });
    expect(await ctx.publish("v2")).toMatchObject({ ok: false, preflightHttp: { status: 422, message: "errors.invalidAssigneeForTenant" } });
  });
});

describe("previewPathwayPublish", () => {
  it("should preview a graph override without writing and list stages that would be removed", async () => {
    const ctx = setup();
    ctx.addVersion("v1", 1, true, [{ id: "a" }, { id: "gone" }]);
    ctx.addVersion("v2", 2, false, [{ id: "a" }, { id: "gone" }]);
    ctx.addStage("stage-a", "v1", "a");
    ctx.addStage("stage-gone", "v1", "gone", 1);
    const before = structuredClone(ctx.store.state);

    const result = await previewPathwayPublish(
      { tenantId: TENANT, pathwayId: PATHWAY, versionId: "v2", graphJsonOverride: graph([{ id: "a" }]), apiT },
      ctx.store,
    );

    expect(result).toMatchObject({
      ok: true,
      preview: { canPublish: true, removedStageKeys: ["gone"], removedStagesWithoutPatients: [{ stageKey: "gone" }], proposedStageKeys: ["a"] },
    });
    expect(ctx.store.state).toEqual(before);
  });
});

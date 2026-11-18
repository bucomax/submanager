import { describe, expect, it } from "vitest";

import { checkStageTransitionPreconditions, evaluateChecklistGate } from "./stage-transition-rules";

const fresh = { currentStageId: "s1", pathwayVersionId: "v1", completedAt: null };
const base = { expectedPathwayVersionId: "v1", toStageId: "s2" };

describe("checkStageTransitionPreconditions", () => {
  it("should allow a transition to another stage of the same version", () => {
    expect(checkStageTransitionPreconditions({ ...base, fresh })).toBeNull();
  });

  it("should report conflict when the pathway row vanished or changed version", () => {
    expect(checkStageTransitionPreconditions({ ...base, fresh: null })).toBe("conflict");
    expect(checkStageTransitionPreconditions({ ...base, fresh: { ...fresh, pathwayVersionId: "v2" } })).toBe(
      "conflict",
    );
  });

  it("should report completed before already_in_target", () => {
    const completed = { ...fresh, completedAt: new Date(), currentStageId: "s2" };
    expect(checkStageTransitionPreconditions({ ...base, fresh: completed })).toBe("completed");
  });

  it("should report already_in_target when the current stage is the target", () => {
    expect(checkStageTransitionPreconditions({ ...base, fresh: { ...fresh, currentStageId: "s2" } })).toBe(
      "already_in_target",
    );
  });
});

describe("evaluateChecklistGate", () => {
  const pending = [{ id: "i1", label: "Exames" }];

  it("should proceed without override when nothing is pending, even with force", () => {
    expect(evaluateChecklistGate({ pending: [], force: true, overrideReason: "x" })).toEqual({
      kind: "proceed",
      forcedOverride: false,
      overrideReason: null,
    });
  });

  it("should block when items are pending and force is not set", () => {
    expect(evaluateChecklistGate({ pending, overrideReason: "x" })).toEqual({ kind: "blocked", pending });
  });

  it("should proceed as forced override with the trimmed reason", () => {
    expect(evaluateChecklistGate({ pending, force: true, overrideReason: "  motivo " })).toEqual({
      kind: "proceed",
      forcedOverride: true,
      overrideReason: "motivo",
    });
  });

  it("should store a null reason when the forced override has a blank or missing reason", () => {
    expect(evaluateChecklistGate({ pending, force: true, overrideReason: "  " })).toMatchObject({
      overrideReason: null,
    });
    expect(evaluateChecklistGate({ pending, force: true })).toMatchObject({
      forcedOverride: true,
      overrideReason: null,
    });
  });
});

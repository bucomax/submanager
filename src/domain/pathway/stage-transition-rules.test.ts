import { describe, expect, it } from "vitest";

import {
  OVERRIDE_REASON_MIN_LENGTH,
  checkStageTransitionPreconditions,
  evaluateChecklistGate,
} from "./stage-transition-rules";

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
    expect(evaluateChecklistGate({ pending, force: true, overrideReason: "  motivo valido " })).toEqual({
      kind: "proceed",
      forcedOverride: true,
      overrideReason: "motivo valido",
    });
  });

  it("should require a reason of at least OVERRIDE_REASON_MIN_LENGTH chars (trimmed) when forcing", () => {
    const required = { kind: "override_reason_required" };
    expect(evaluateChecklistGate({ pending, force: true })).toEqual(required);
    expect(evaluateChecklistGate({ pending, force: true, overrideReason: null })).toEqual(required);
    expect(evaluateChecklistGate({ pending, force: true, overrideReason: "   " })).toEqual(required);
    expect(
      evaluateChecklistGate({ pending, force: true, overrideReason: ` ${"x".repeat(OVERRIDE_REASON_MIN_LENGTH - 1)} ` }),
    ).toEqual(required);
    expect(
      evaluateChecklistGate({ pending, force: true, overrideReason: "x".repeat(OVERRIDE_REASON_MIN_LENGTH) }),
    ).toMatchObject({ kind: "proceed", forcedOverride: true });
  });

  it("should not demand a reason without force: the transition stays blocked", () => {
    expect(evaluateChecklistGate({ pending, overrideReason: "" })).toEqual({ kind: "blocked", pending });
  });
});

import { describe, expect, it } from "vitest";

import { analyzeStageRemoval, classifyOwnStage } from "./stage-removal";

const old = [
  { id: "1", stageKey: "keep", name: "Keep", currentPatients: 3 },
  { id: "2", stageKey: "gone-with", name: "Gone with", currentPatients: 2 },
  { id: "3", stageKey: "gone-empty", name: "Gone empty", currentPatients: 0 },
];

describe("analyzeStageRemoval", () => {
  it("should split removed stages by whether they still have patients", () => {
    const result = analyzeStageRemoval(old, new Set(["keep", "new"]));
    expect(result.removedStageKeys).toEqual(["gone-with", "gone-empty"]);
    expect(result.removedWithPatients.map((s) => s.stageKey)).toEqual(["gone-with"]);
    expect(result.removedWithoutPatients.map((s) => s.stageKey)).toEqual(["gone-empty"]);
  });

  it("should report nothing removed when all keys are kept", () => {
    const result = analyzeStageRemoval(old, new Set(["keep", "gone-with", "gone-empty"]));
    expect(result.removedStageKeys).toEqual([]);
  });
});

describe("classifyOwnStage", () => {
  const own = { id: "o", stageKey: "k", currentPatients: 0, transitionsTo: 0, transitionsFrom: 0 };
  const ctx = { keyClashesWithPublished: false, hasPublishedVersion: true };

  it("should reuse a stage whose key is kept and does not clash with the published version", () => {
    expect(classifyOwnStage({ own, newStageKeys: new Set(["k"]), ...ctx })).toEqual({ kind: "reuse" });
  });

  it("should delete a stage without history that is not reusable", () => {
    expect(classifyOwnStage({ own, newStageKeys: new Set(), ...ctx })).toEqual({ kind: "delete" });
    expect(
      classifyOwnStage({ own, newStageKeys: new Set(["k"]), keyClashesWithPublished: true, hasPublishedVersion: true }),
    ).toEqual({ kind: "delete" });
  });

  it("should move a removed stage with history to the published version, preserving transitions", () => {
    expect(
      classifyOwnStage({ own: { ...own, transitionsTo: 1 }, newStageKeys: new Set(), ...ctx }),
    ).toEqual({ kind: "move_to_published" });
  });

  it("should conflict when a stage with history cannot be preserved", () => {
    const withHistory = { ...own, transitionsFrom: 2 };
    expect(classifyOwnStage({ own: withHistory, newStageKeys: new Set(), keyClashesWithPublished: false, hasPublishedVersion: false })).toEqual({ kind: "conflict" });
    expect(classifyOwnStage({ own: withHistory, newStageKeys: new Set(["k"]), keyClashesWithPublished: true, hasPublishedVersion: true })).toEqual({ kind: "conflict" });
  });
});

import { describe, expect, it } from "vitest";

import { stageAssigneeCandidates } from "./stage-assignee";

describe("stageAssigneeCandidates", () => {
  it("should prefer the stage list, then append the client assignee", () => {
    expect(
      stageAssigneeCandidates({ defaultAssigneeUserIds: ["a", "b"], defaultAssigneeUserId: "legacy" }, "c"),
    ).toEqual(["a", "b", "c"]);
  });

  it("should fall back to the legacy single assignee when the list is empty", () => {
    expect(stageAssigneeCandidates({ defaultAssigneeUserIds: [], defaultAssigneeUserId: "legacy" }, null)).toEqual([
      "legacy",
    ]);
  });

  it("should return only the client assignee when the stage has no defaults, or nothing at all", () => {
    expect(stageAssigneeCandidates({ defaultAssigneeUserIds: [], defaultAssigneeUserId: null }, "c")).toEqual(["c"]);
    expect(stageAssigneeCandidates({ defaultAssigneeUserIds: [], defaultAssigneeUserId: null }, null)).toEqual([]);
  });
});

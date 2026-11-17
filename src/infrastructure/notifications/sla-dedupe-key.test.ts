import { describe, expect, it } from "vitest";

import { buildSlaDedupeKey } from "./sla-dedupe-key";

const base = {
  patientPathwayId: "pp1",
  stageId: "st1",
  enteredStageAt: new Date("2026-01-01T10:00:00.000Z"),
  level: "warning" as const,
};

describe("buildSlaDedupeKey", () => {
  it("should be stable for the same stage entry and level", () => {
    expect(buildSlaDedupeKey(base)).toBe(buildSlaDedupeKey({ ...base }));
  });

  it("should differ per level, stage and stage entry", () => {
    const key = buildSlaDedupeKey(base);
    expect(buildSlaDedupeKey({ ...base, level: "critical" })).not.toBe(key);
    expect(buildSlaDedupeKey({ ...base, stageId: "st2" })).not.toBe(key);
    expect(
      buildSlaDedupeKey({ ...base, enteredStageAt: new Date("2026-02-01T10:00:00.000Z") }),
    ).not.toBe(key);
  });
});

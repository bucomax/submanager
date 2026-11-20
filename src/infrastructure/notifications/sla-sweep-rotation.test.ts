import { describe, expect, it } from "vitest";

import { rotateForDailySweep } from "./sla-sweep-rotation";

const items = Array.from({ length: 50 }, (_, i) => `pathway-${i}`);

describe("rotateForDailySweep", () => {
  it("should keep every item exactly once", () => {
    const rotated = rotateForDailySweep(items, new Date("2026-11-20T11:00:00Z"));

    expect(rotated).toHaveLength(items.length);
    expect(new Set(rotated)).toEqual(new Set(items));
  });

  it("should preserve cyclic order (only the starting point moves)", () => {
    const rotated = rotateForDailySweep(items, new Date("2026-11-20T11:00:00Z"));
    const start = items.indexOf(rotated[0]!);

    expect(rotated).toEqual([...items.slice(start), ...items.slice(0, start)]);
  });

  it("should be stable within the same day", () => {
    const morning = rotateForDailySweep(items, new Date("2026-11-20T01:00:00Z"));
    const evening = rotateForDailySweep(items, new Date("2026-11-20T23:00:00Z"));

    expect(evening).toEqual(morning);
  });

  it("should start at different points across days so a truncated sweep does not always skip the same tail", () => {
    const starts = new Set(
      Array.from({ length: 14 }, (_, day) =>
        rotateForDailySweep(items, new Date(Date.UTC(2026, 10, 1 + day, 11)))[0],
      ),
    );

    expect(starts.size).toBeGreaterThan(5);
  });

  it("should not mutate the input and handle empty or single-item lists", () => {
    const original = [...items];
    rotateForDailySweep(items, new Date("2026-11-20T11:00:00Z"));

    expect(items).toEqual(original);
    expect(rotateForDailySweep([], new Date())).toEqual([]);
    expect(rotateForDailySweep(["only"], new Date())).toEqual(["only"]);
  });
});

import { describe, expect, it } from "vitest";

import { createProcessThrottle } from "./process-throttle";

describe("createProcessThrottle", () => {
  it("should allow the first run and block repeats inside the window", () => {
    const throttle = createProcessThrottle(60_000);

    expect(throttle.tryRun("sla:p1", 1_000)).toBe(true);
    expect(throttle.tryRun("sla:p1", 30_000)).toBe(false);
    expect(throttle.tryRun("sla:p1", 60_999)).toBe(false);
  });

  it("should allow again once the window has elapsed", () => {
    const throttle = createProcessThrottle(60_000);

    throttle.tryRun("sla:p1", 1_000);

    expect(throttle.tryRun("sla:p1", 61_000)).toBe(true);
    expect(throttle.tryRun("sla:p1", 62_000)).toBe(false);
  });

  it("should track keys independently", () => {
    const throttle = createProcessThrottle(60_000);

    expect(throttle.tryRun("sla:p1", 1_000)).toBe(true);
    expect(throttle.tryRun("sla:p2", 1_000)).toBe(true);
  });

  it("should purge expired entries instead of growing without bound", () => {
    const throttle = createProcessThrottle(1_000);
    for (let i = 0; i < 1_000; i += 1) throttle.tryRun(`k${i}`, 0);

    // Todas expiraram: uma nova chave dispara a limpeza e as antigas voltam a ser permitidas.
    expect(throttle.tryRun("fresh", 5_000)).toBe(true);
    expect(throttle.tryRun("k0", 5_000)).toBe(true);
  });
});

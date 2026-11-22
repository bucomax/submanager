import { describe, expect, it } from "vitest";

import { resolveQueueConsumerAvailable } from "./redis-connection";

const REDIS = { REDIS_URL: "redis://localhost:6379" };

describe("resolveQueueConsumerAvailable", () => {
  it("should be false without Redis", () => {
    expect(resolveQueueConsumerAvailable({})).toBe(false);
    expect(resolveQueueConsumerAvailable({ QUEUE_EXTERNAL_WORKER: "1" })).toBe(false);
  });

  it("should be true on self-hosted with the local worker enabled", () => {
    expect(resolveQueueConsumerAvailable(REDIS)).toBe(true);
  });

  it("should be false with the worker disabled unless an external worker exists", () => {
    expect(resolveQueueConsumerAvailable({ ...REDIS, DISABLE_NOTIFICATION_WORKER: "true" })).toBe(false);
    expect(
      resolveQueueConsumerAvailable({ ...REDIS, DISABLE_NOTIFICATION_WORKER: "true", QUEUE_EXTERNAL_WORKER: "1" }),
    ).toBe(true);
  });
});

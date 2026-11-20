import { describe, expect, it } from "vitest";

import { WEBHOOK_TIMESTAMP_TOLERANCE_MS, checkWebhookTimestamp } from "./webhook-timestamp";

const NOW = Date.parse("2026-11-20T12:00:00.000Z");

describe("checkWebhookTimestamp", () => {
  it("should treat a missing timestamp as fresh (idempotency still applies)", () => {
    expect(checkWebhookTimestamp(undefined, NOW)).toBe("fresh");
  });

  it("should accept timestamps within the tolerance, past or future", () => {
    expect(checkWebhookTimestamp(new Date(NOW - WEBHOOK_TIMESTAMP_TOLERANCE_MS).toISOString(), NOW)).toBe("fresh");
    expect(checkWebhookTimestamp(new Date(NOW + WEBHOOK_TIMESTAMP_TOLERANCE_MS).toISOString(), NOW)).toBe("fresh");
  });

  it("should reject timestamps outside +/-5 minutes", () => {
    expect(checkWebhookTimestamp(new Date(NOW - WEBHOOK_TIMESTAMP_TOLERANCE_MS - 1).toISOString(), NOW)).toBe("stale");
    expect(checkWebhookTimestamp(new Date(NOW + WEBHOOK_TIMESTAMP_TOLERANCE_MS + 1).toISOString(), NOW)).toBe("stale");
  });

  it("should flag unparsable timestamps", () => {
    expect(checkWebhookTimestamp("not-a-date", NOW)).toBe("invalid");
    expect(checkWebhookTimestamp("", NOW)).toBe("invalid");
  });
});

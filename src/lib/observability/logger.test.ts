import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureException = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({
  captureException,
  getIsolationScope: () => ({ getScopeData: () => ({ tags: { request_id: "req-1" } }) }),
}));

const { logger } = await import("./logger");

describe("logger", () => {
  let lines: string[];

  beforeEach(() => {
    lines = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
    captureException.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  const last = () => JSON.parse(lines.at(-1)!) as Record<string, unknown>;

  it("should emit one JSON line with level, msg, context and requestId", () => {
    logger.info("notification emitted", { tenantId: "t1", clientId: "c1" });

    expect(lines).toHaveLength(1);
    expect(lines[0]!.endsWith("\n")).toBe(true);
    expect(last()).toMatchObject({ level: "info", msg: "notification emitted", tenantId: "t1", clientId: "c1", requestId: "req-1" });
  });

  it("should redact sensitive keys and PII patterns", () => {
    logger.warn("failed for maria@example.com", { phone: "11999990000", nested: { cpf: "123.456.789-09", id: "x" }, note: "ok" });

    expect(last()).toMatchObject({
      msg: "failed for [redacted]",
      phone: "[redacted]",
      nested: { cpf: "[redacted]", id: "x" },
      note: "[redacted]",
    });
  });

  it("should serialize errors without stack and send error-level events to Sentry", () => {
    const err = Object.assign(new Error("boom for 123.456.789-09"), { code: "P2002" });

    logger.error("persist failed", { err, tenantId: "t1" });

    expect(last()).toMatchObject({ level: "error", err: { name: "Error", code: "P2002", message: "boom for [redacted]" } });
    expect(last().err).not.toHaveProperty("stack");
    expect(captureException).toHaveBeenCalledWith(err, { extra: { msg: "persist failed", tenantId: "t1" } });
  });

  it("should not report to Sentry below error level or without an error", () => {
    logger.warn("degraded", { err: new Error("x") });
    logger.error("no error object", { tenantId: "t1" });
    expect(captureException).not.toHaveBeenCalled();
  });
});

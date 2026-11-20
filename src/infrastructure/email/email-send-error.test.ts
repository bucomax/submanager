import { describe, expect, it, vi } from "vitest";

import {
  classifyResendError,
  EmailSendError,
  isRetryableEmailError,
  isTransientSmtpFailure,
  withTimeout,
} from "./email-send-error";

describe("classifyResendError", () => {
  it("should mark rate limit and server errors as retryable", () => {
    expect(classifyResendError({ name: "rate_limit_exceeded", message: "slow down", statusCode: 429 }).retryable).toBe(true);
    expect(classifyResendError({ message: "boom", statusCode: 503 }).retryable).toBe(true);
    expect(classifyResendError({ name: "application_error", message: "network" }).retryable).toBe(true);
    expect(classifyResendError({ name: "internal_server_error", message: "oops" }).retryable).toBe(true);
  });

  it("should mark validation and credential errors as permanent", () => {
    expect(classifyResendError({ name: "validation_error", message: "bad to", statusCode: 422 }).retryable).toBe(false);
    expect(classifyResendError({ name: "invalid_from_address", message: "from" }).retryable).toBe(false);
    expect(classifyResendError({ name: "missing_api_key", message: "key", statusCode: 401 }).retryable).toBe(false);
  });
});

describe("isRetryableEmailError", () => {
  it("should only trust classified errors", () => {
    expect(isRetryableEmailError(new EmailSendError("x", true))).toBe(true);
    expect(isRetryableEmailError(new EmailSendError("x", false))).toBe(false);
    expect(isRetryableEmailError(new Error("unclassified"))).toBe(false);
    expect(isRetryableEmailError(undefined)).toBe(false);
  });
});

describe("isTransientSmtpFailure", () => {
  it("should retry temporary SMTP replies and connection problems", () => {
    expect(isTransientSmtpFailure({ responseCode: 451 })).toBe(true);
    expect(isTransientSmtpFailure({ code: "ETIMEDOUT" })).toBe(true);
    expect(isTransientSmtpFailure({ code: "ECONNECTION" })).toBe(true);
  });

  it("should not retry permanent replies, auth failures or blocked hosts", () => {
    expect(isTransientSmtpFailure({ responseCode: 550 })).toBe(false);
    expect(isTransientSmtpFailure({ code: "EAUTH" })).toBe(false);
    expect(isTransientSmtpFailure({ name: "SmtpHostNotAllowedError", code: "ECONNREFUSED" })).toBe(false);
    expect(isTransientSmtpFailure({})).toBe(false);
  });
});

describe("withTimeout", () => {
  it("should resolve with the underlying value when fast enough", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 1_000, "send")).resolves.toBe("ok");
  });

  it("should reject with a retryable error when the call hangs", async () => {
    vi.useFakeTimers();
    try {
      const pending = withTimeout(new Promise<never>(() => undefined), 15_000, "Resend send");
      const assertion = expect(pending).rejects.toMatchObject({ name: "EmailSendError", retryable: true });
      await vi.advanceTimersByTimeAsync(15_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});

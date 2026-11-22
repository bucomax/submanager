import { beforeEach, describe, expect, it, vi } from "vitest";

const warn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/observability/logger", () => ({ logger: { warn } }));

const { inspectEnv, validateRuntimeEnv } = await import("./env");

const COMPLETE_ENV = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:s3cret@db.example.com:5432/app",
  NEXTAUTH_SECRET: "super-secret-value",
  NEXTAUTH_URL: "https://app.example.com",
  APP_TOKEN_SECRET: "x",
  CRON_SECRET: "x",
  RESEND_API_KEY: "x",
  EMAIL_FROM: "App <noreply@example.com>",
  GCS_BUCKET_NAME: "bucket",
  GCS_PROJECT_ID: "project",
};

describe("validateRuntimeEnv", () => {
  beforeEach(() => {
    warn.mockReset();
  });

  it("should pass silently with a complete production env", () => {
    expect(() => validateRuntimeEnv(COMPLETE_ENV)).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });

  it("should throw in production listing only the names of missing required variables", () => {
    const env = { ...COMPLETE_ENV, DATABASE_URL: "", NEXTAUTH_SECRET: undefined, NEXTAUTH_URL: undefined };
    let message = "";
    try {
      validateRuntimeEnv(env);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("DATABASE_URL");
    expect(message).toContain("NEXTAUTH_SECRET");
    expect(message).toContain("NEXTAUTH_URL (or APP_PUBLIC_URL)");
    expect(message).not.toContain("s3cret");
  });

  it("should accept APP_PUBLIC_URL in place of NEXTAUTH_URL", () => {
    const env = { ...COMPLETE_ENV, NEXTAUTH_URL: undefined, APP_PUBLIC_URL: "https://app.example.com" };
    expect(() => validateRuntimeEnv(env)).not.toThrow();
  });

  it("should only warn (with names, never values) for missing recommended variables", () => {
    const env = { ...COMPLETE_ENV, CRON_SECRET: undefined, GCS_BUCKET_NAME: "  " };

    expect(() => validateRuntimeEnv(env)).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![1]).toEqual({ missing: ["CRON_SECRET", "GCS_BUCKET_NAME"] });
  });

  it("should warn when the public URL points to localhost in production", () => {
    validateRuntimeEnv({ ...COMPLETE_ENV, NEXTAUTH_URL: "http://localhost:3000" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain("localhost");
  });

  it("should not validate outside production nor during next build", () => {
    expect(() => validateRuntimeEnv({ NODE_ENV: "development" })).not.toThrow();
    expect(() => validateRuntimeEnv({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("inspectEnv", () => {
  it("should flag every required name on an empty env", () => {
    expect(inspectEnv({}).missingRequired).toEqual(["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL (or APP_PUBLIC_URL)"]);
  });
});

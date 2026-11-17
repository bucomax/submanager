import { describe, expect, it, vi } from "vitest";

vi.mock("./auth-options", () => ({ authOptions: {} }));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));

const { isSessionExpired } = await import("./session");

describe("isSessionExpired", () => {
  const now = Date.parse("2026-01-01T12:00:00Z");

  it("should be false when expires is missing", () => {
    expect(isSessionExpired(undefined, now)).toBe(false);
  });

  it("should be true when expires is in the past", () => {
    expect(isSessionExpired("2026-01-01T11:59:59Z", now)).toBe(true);
  });

  it("should be false when expires is in the future", () => {
    expect(isSessionExpired("2026-01-01T12:00:01Z", now)).toBe(false);
  });
});

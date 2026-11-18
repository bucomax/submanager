import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";

const calls: string[] = [];
const apiT = ((key: string) => key) as never;

const guards = vi.hoisted(() => ({
  requireSessionOr401: vi.fn(),
  getActiveTenantIdOr400: vi.fn(),
  assertActiveTenantMembership: vi.fn(),
  assertTenantAdminOrSuper: vi.fn(),
  superAdminOr403: vi.fn(),
}));
const rateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/guards", () => guards);
vi.mock("@/lib/api/rate-limit", () => ({ rateLimit: rateLimitMock }));
vi.mock("@/lib/api/i18n", () => ({ getApiT: async () => apiT }));
vi.mock("@/lib/api-response", () => ({
  jsonError: (code: string, message: string, status: number) => Response.json({ code, message }, { status }),
  jsonSuccess: (data: unknown) => Response.json({ data }),
}));

import { withSessionRoute, withTenantRoute } from "./route-handler";

const session = { user: { id: "u1", globalRole: "user" } } as unknown as Session;
const forbidden = () => Response.json({ code: "FORBIDDEN" }, { status: 403 });
const request = new Request("http://localhost/api/v1/x");

function track<T>(name: string, value: T) {
  return vi.fn(async () => {
    calls.push(name);
    return value;
  });
}

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
  guards.requireSessionOr401.mockImplementation(track("session", { session, response: null }));
  guards.getActiveTenantIdOr400.mockImplementation(track("tenant", { tenantId: "t1", response: null }));
  guards.assertActiveTenantMembership.mockImplementation(track("membership", null));
  guards.assertTenantAdminOrSuper.mockImplementation(track("admin", null));
  guards.superAdminOr403.mockImplementation(track("super", null));
  rateLimitMock.mockResolvedValue(null);
});

describe("withTenantRoute", () => {
  it("runs session -> tenant -> membership in order and passes context to the handler", async () => {
    const handler = vi.fn(async (args: { tenantId: string; params: { id: string } }) => {
      calls.push("handler");
      return Response.json({ tenantId: args.tenantId, id: args.params.id });
    });
    const route = withTenantRoute<{ id: string }>(handler);

    const res = await route(request, { params: Promise.resolve({ id: "abc" }) });

    expect(calls).toEqual(["session", "tenant", "membership", "handler"]);
    expect(await res.json()).toEqual({ tenantId: "t1", id: "abc" });
    expect(handler.mock.calls[0]![0]).toMatchObject({ request, session, tenantId: "t1", apiT });
  });

  it("returns the 401 response and skips later guards and handler", async () => {
    const unauthorized = Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
    guards.requireSessionOr401.mockResolvedValue({ session: null, response: unauthorized });
    const handler = vi.fn();

    const res = await withTenantRoute(handler)(request);

    expect(res).toBe(unauthorized);
    expect(guards.getActiveTenantIdOr400).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("stops at tenant resolution failure", async () => {
    const tenantErr = Response.json({ code: "TENANT_REQUIRED" }, { status: 400 });
    guards.getActiveTenantIdOr400.mockResolvedValue({ tenantId: null, response: tenantErr });
    const handler = vi.fn();

    const res = await withTenantRoute(handler)(request);

    expect(res).toBe(tenantErr);
    expect(guards.assertActiveTenantMembership).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("blocks non-members with the membership response", async () => {
    const denied = forbidden();
    guards.assertActiveTenantMembership.mockResolvedValue(denied);
    const handler = vi.fn();

    expect(await withTenantRoute(handler)(request)).toBe(denied);
    expect(handler).not.toHaveBeenCalled();
  });

  it("role admin uses assertTenantAdminOrSuper (with custom message key) instead of membership", async () => {
    const handler = vi.fn(async () => Response.json({}));
    const route = withTenantRoute(handler, { role: "admin", forbiddenMessageKey: "errors.managePathwaysPermissionDenied" });

    await route(request);

    expect(calls).toEqual(["session", "tenant", "admin"]);
    expect(guards.assertTenantAdminOrSuper).toHaveBeenCalledWith(
      session,
      "t1",
      request,
      apiT,
      "errors.managePathwaysPermissionDenied",
    );
    expect(guards.assertActiveTenantMembership).not.toHaveBeenCalled();
  });

  it("role admin blocks non-admins", async () => {
    const denied = forbidden();
    guards.assertTenantAdminOrSuper.mockResolvedValue(denied);
    const handler = vi.fn();

    expect(await withTenantRoute(handler, { role: "admin" })(request)).toBe(denied);
    expect(handler).not.toHaveBeenCalled();
  });

  it("applies the extra rate limit preset per user after the guards", async () => {
    const limited = Response.json({ code: "RATE_LIMITED" }, { status: 429 });
    rateLimitMock.mockResolvedValue(limited);
    const handler = vi.fn();

    const res = await withTenantRoute(handler, { rateLimit: "filePresign" })(request);

    expect(rateLimitMock).toHaveBeenCalledWith("filePresign", "u1");
    expect(res).toBe(limited);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("withSessionRoute", () => {
  it("does not resolve tenant and passes empty params when none are given", async () => {
    const handler = vi.fn(async (args: { session: Session; params: object }) => {
      expect(args).toMatchObject({ session, params: {} });
      return Response.json({});
    });

    await withSessionRoute(handler)(request);

    expect(calls).toEqual(["session"]);
    expect(guards.getActiveTenantIdOr400).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("role super_admin enforces superAdminOr403", async () => {
    const denied = forbidden();
    guards.superAdminOr403.mockResolvedValue(denied);
    const handler = vi.fn();

    expect(await withSessionRoute(handler, { role: "super_admin" })(request)).toBe(denied);
    expect(handler).not.toHaveBeenCalled();
  });
});

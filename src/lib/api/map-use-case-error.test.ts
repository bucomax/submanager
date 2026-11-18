import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-response", () => ({
  jsonError: (code: string, message: string, status: number, details?: unknown) =>
    Response.json({ code, message, details }, { status }),
}));

import { mapUseCaseError, type UseCaseErrorTable } from "./map-use-case-error";
import { CLIENT_REFERENCE_ERRORS } from "./error-tables/client";
import { CREATE_TENANT_ERRORS, INVITE_MEMBER_ERRORS } from "./error-tables/admin";
import { TRANSITION_STAGE_ERRORS } from "./error-tables/patient-pathway";

const apiT = ((key: string) => `t:${key}`) as never;

const table: UseCaseErrorTable<"A" | "B"> = {
  A: { status: 404, errorCode: "NOT_FOUND", messageKey: "errors.a" },
  B: { status: 409, errorCode: "CONFLICT", messageKey: "errors.b" },
};

describe("mapUseCaseError", () => {
  it("maps code to status, error code and translated message", async () => {
    const res = mapUseCaseError("A", table, apiT);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: "NOT_FOUND", message: "t:errors.a" });
  });

  it("prefers an upstream message and forwards details", async () => {
    const res = mapUseCaseError("B", table, apiT, { message: "from resend", details: { x: 1 } });
    expect(await res.json()).toMatchObject({ code: "CONFLICT", message: "from resend", details: { x: 1 } });
  });

  it("falls back to translation when upstream message is null", async () => {
    const res = mapUseCaseError("B", table, apiT, { message: null });
    expect(await res.json()).toMatchObject({ message: "t:errors.b" });
  });
});

describe("domain tables", () => {
  it("keeps the same HTTP mapping as the previous inline chains", () => {
    expect(CLIENT_REFERENCE_ERRORS.INVALID_ASSIGNEE).toMatchObject({ status: 422, errorCode: "VALIDATION_ERROR" });
    expect(INVITE_MEMBER_ERRORS.TENANT_NOT_FOUND.status).toBe(404);
    expect(CREATE_TENANT_ERRORS.TENANT_NOT_FOUND.status).toBe(500);
    expect(TRANSITION_STAGE_ERRORS.LOCK_CONFLICT).toBe(TRANSITION_STAGE_ERRORS.STAGE_CONFLICT);
    expect(TRANSITION_STAGE_ERRORS.ALREADY_IN_TARGET_STAGE.status).toBe(422);
  });
});

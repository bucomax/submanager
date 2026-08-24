import { beforeEach, describe, expect, it } from "vitest";
import * as Sentry from "@sentry/nextjs";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { REQUEST_ID_HEADER, tagRequestId } from "@/lib/observability/request-id";

describe("jsonError", () => {
  beforeEach(() => {
    Sentry.getIsolationScope().clear();
  });

  it("devolve o request_id no header, único caminho até o browser em rota de API", () => {
    tagRequestId(
      new Request("https://app.local/api/v1/clients", {
        headers: { [REQUEST_ID_HEADER]: "req-42" },
      }),
    );

    expect(jsonError("BOOM", "falhou", 500).headers.get(REQUEST_ID_HEADER)).toBe("req-42");
  });

  it("omite o header quando nada foi marcado", () => {
    expect(jsonError("BOOM", "falhou", 500).headers.get(REQUEST_ID_HEADER)).toBeNull();
  });

  it("preserva status e envelope de erro", async () => {
    const res = jsonError("NOT_FOUND", "não achei", 404);

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      error: { code: "NOT_FOUND", message: "não achei" },
    });
  });

  it("não carimba header em resposta de sucesso", async () => {
    tagRequestId(
      new Request("https://app.local/api/v1/clients", {
        headers: { [REQUEST_ID_HEADER]: "req-42" },
      }),
    );

    expect(jsonSuccess({ ok: true }).headers.get(REQUEST_ID_HEADER)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  severityForHttpStatus,
  shouldReportHttpStatus,
} from "@/lib/observability/error-taxonomy";

describe("shouldReportHttpStatus", () => {
  it.each([400, 401, 403, 404, 409, 412, 422, 429])(
    "não reporta %i, que é fluxo de negócio esperado",
    (status) => {
      expect(shouldReportHttpStatus(status)).toBe(false);
    },
  );

  it("não reporta 429 (rate limit): é a rota pública se defendendo, não um defeito", () => {
    expect(shouldReportHttpStatus(429)).toBe(false);
  });

  it("não reporta 412 (precondition failed): guarda de estado, mesma família do 409", () => {
    expect(shouldReportHttpStatus(412)).toBe(false);
  });

  it.each([500, 502, 503, 504])("reporta %i", (status) => {
    expect(shouldReportHttpStatus(status)).toBe(true);
  });

  it("não reporta 2xx", () => {
    expect(shouldReportHttpStatus(200)).toBe(false);
  });

  it("reporta 4xx fora da lista de esperados", () => {
    expect(shouldReportHttpStatus(418)).toBe(true);
  });
});

describe("severityForHttpStatus", () => {
  it("trata 5xx como error", () => {
    expect(severityForHttpStatus(500)).toBe("error");
  });

  it("trata 4xx inesperado como warning", () => {
    expect(severityForHttpStatus(418)).toBe("warning");
  });
});

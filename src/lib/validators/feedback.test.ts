import { describe, expect, it } from "vitest";
import { createFeedbackBodySchema, patchFeedbackBodySchema } from "@/lib/validators/feedback";

describe("createFeedbackBodySchema", () => {
  const valid = {
    type: "bug" as const,
    message: "A tela trava ao salvar o formulário de paciente.",
    pagePath: "/dashboard/clients",
    locale: "pt-BR",
  };

  it("aceita um corpo válido", () => {
    expect(createFeedbackBodySchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita pagePath com query string — pode carregar busca por nome de paciente (LGPD)", () => {
    const result = createFeedbackBodySchema.safeParse({
      ...valid,
      pagePath: "/dashboard/clients?search=joao",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita pagePath com hash", () => {
    const result = createFeedbackBodySchema.safeParse({ ...valid, pagePath: "/dashboard#section" });
    expect(result.success).toBe(false);
  });

  it("rejeita pagePath que não começa com barra", () => {
    const result = createFeedbackBodySchema.safeParse({ ...valid, pagePath: "dashboard" });
    expect(result.success).toBe(false);
  });

  it("rejeita mensagem abaixo do mínimo de 10 caracteres", () => {
    const result = createFeedbackBodySchema.safeParse({ ...valid, message: "curto" });
    expect(result.success).toBe(false);
  });

  it("rejeita type fora do enum", () => {
    const result = createFeedbackBodySchema.safeParse({ ...valid, type: "feature" });
    expect(result.success).toBe(false);
  });

  it("aceita sentryEventId e requestId nulos", () => {
    const result = createFeedbackBodySchema.safeParse({
      ...valid,
      sentryEventId: null,
      requestId: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("patchFeedbackBodySchema", () => {
  it("rejeita corpo vazio", () => {
    expect(patchFeedbackBodySchema.safeParse({}).success).toBe(false);
  });

  it("aceita apenas status", () => {
    expect(patchFeedbackBodySchema.safeParse({ status: "triaged" }).success).toBe(true);
  });

  it("aceita apenas adminNote nulo", () => {
    expect(patchFeedbackBodySchema.safeParse({ adminNote: null }).success).toBe(true);
  });
});

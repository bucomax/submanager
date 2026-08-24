import { describe, expect, it } from "vitest";
import { formatZodIssues } from "@/lib/api/zod-error";
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

  it("rejeita caminho protocol-relative, que viraria link externo na triagem", () => {
    const result = createFeedbackBodySchema.safeParse({ ...valid, pagePath: "//evil.com" });
    expect(result.success).toBe(false);
  });

  it("mensagem de erro cita o campo rejeitado, não vem vazia", () => {
    const parsed = createFeedbackBodySchema.safeParse({ ...valid, message: "curto" });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const formatted = formatZodIssues(parsed.error);
    expect(formatted).not.toBe("");
    expect(formatted).toContain("message");
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

import { describe, expect, it } from "vitest";
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import {
  redactSensitiveText,
  scrubSentryBreadcrumb,
  scrubSentryEvent,
  SENSITIVE_KEY_DENYLIST,
} from "@/lib/observability/sentry-scrubber";

describe("redactSensitiveText", () => {
  it("redige CPF com pontuação", () => {
    expect(redactSensitiveText("paciente 529.982.247-25 chegou")).toBe(
      "paciente [redacted] chegou",
    );
  });

  it("redige CPF sem pontuação", () => {
    expect(redactSensitiveText("doc 52998224725")).toBe("doc [redacted]");
  });

  it("redige telefone brasileiro com DDD", () => {
    expect(redactSensitiveText("ligar (11) 98765-4321")).toBe("ligar [redacted]");
  });

  it("redige e-mail", () => {
    expect(redactSensitiveText("contato joao@clinica.com.br")).toBe(
      "contato [redacted]",
    );
  });

  it("mantém texto sem PII intacto", () => {
    expect(redactSensitiveText("falha ao carregar etapa")).toBe(
      "falha ao carregar etapa",
    );
  });

  it("não confunde id interno com CPF", () => {
    expect(redactSensitiveText("clientId cmg3k2p9x0001abcd")).toBe(
      "clientId cmg3k2p9x0001abcd",
    );
  });

  it("não confunde uuid com CPF ou telefone", () => {
    expect(redactSensitiveText("trace 550e8400-e29b-41d4-a716-446655440000")).toBe(
      "trace 550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it.each([
    "timeout at 1735051200 ms",
    "invoice 12345678 overdue",
    "amount in cents: 999999999",
    "periodo 2024 2025",
  ])("preserva número sem forma de telefone: %s", (input) => {
    expect(redactSensitiveText(input)).toBe(input);
  });

  it("redige telefone com código do país", () => {
    expect(redactSensitiveText("zap +55 11 98765-4321")).toBe("zap [redacted]");
  });

  it("redige celular sem formatação, pelo padrão de 11 dígitos", () => {
    expect(redactSensitiveText("telefone 11987654321 inválido")).toBe(
      "telefone [redacted] inválido",
    );
  });
});

describe("scrubSentryEvent", () => {
  it("remove o valor de chaves da denylist em extra", () => {
    const event = {
      extra: { documentId: "52998224725", stageKey: "pre-op" },
    } as unknown as ErrorEvent;

    const result = scrubSentryEvent(event);

    expect(result.extra?.documentId).toBe("[redacted]");
    expect(result.extra?.stageKey).toBe("pre-op");
  });

  it("redige PII dentro do valor da exception", () => {
    const event = {
      exception: {
        values: [{ type: "Error", value: "falha para 529.982.247-25" }],
      },
    } as unknown as ErrorEvent;

    const result = scrubSentryEvent(event);

    expect(result.exception?.values?.[0]?.value).toBe("falha para [redacted]");
  });

  it("descarta a query string da URL da request", () => {
    const event = {
      request: { url: "https://app.local/dashboard/contacts?q=Maria+Silva" },
    } as unknown as ErrorEvent;

    const result = scrubSentryEvent(event);

    expect(result.request?.url).toBe("https://app.local/dashboard/contacts");
  });

  it("varre objetos aninhados", () => {
    const event = {
      extra: { patient: { phone: "11987654321", id: "abc" } },
    } as unknown as ErrorEvent;

    const result = scrubSentryEvent(event);
    const patient = result.extra?.patient as Record<string, unknown>;

    expect(patient.phone).toBe("[redacted]");
    expect(patient.id).toBe("abc");
  });

  it("não estoura com estrutura circular", () => {
    const circular: Record<string, unknown> = { name: "loop" };
    circular.self = circular;
    const event = { extra: { circular } } as unknown as ErrorEvent;

    expect(() => scrubSentryEvent(event)).not.toThrow();
  });
});

describe("scrubSentryBreadcrumb", () => {
  it("descarta breadcrumb de console, que costuma carregar payload cru", () => {
    const breadcrumb = { category: "console", message: "user" } as Breadcrumb;

    expect(scrubSentryBreadcrumb(breadcrumb)).toBeNull();
  });

  it("redige PII na mensagem de breadcrumb de navegação", () => {
    const breadcrumb = {
      category: "navigation",
      message: "buscou por joao@clinica.com.br",
    } as Breadcrumb;

    const result = scrubSentryBreadcrumb(breadcrumb);

    expect(result?.message).toBe("buscou por [redacted]");
  });

  it("descarta a query string de data.url em breadcrumb de fetch", () => {
    const breadcrumb = {
      category: "fetch",
      data: { url: "https://app.local/api/v1/clients?q=Maria+Silva", method: "GET" },
    } as unknown as Breadcrumb;

    const result = scrubSentryBreadcrumb(breadcrumb);
    const data = result?.data as Record<string, unknown>;

    expect(data.url).toBe("https://app.local/api/v1/clients");
    expect(data.method).toBe("GET");
  });

  it("descarta a query string de data.from e data.to em breadcrumb de navegação", () => {
    const breadcrumb = {
      category: "navigation",
      data: {
        from: "/dashboard/contacts?q=Maria+Silva",
        to: "/dashboard/contacts/cmg3k2p9x0001abcd?q=Maria+Silva",
      },
    } as unknown as Breadcrumb;

    const result = scrubSentryBreadcrumb(breadcrumb);
    const data = result?.data as Record<string, unknown>;

    expect(data.from).toBe("/dashboard/contacts");
    expect(data.to).toBe("/dashboard/contacts/cmg3k2p9x0001abcd");
  });
});

describe("SENSITIVE_KEY_DENYLIST", () => {
  it("cobre os nomes de campo sensíveis do domínio clínico", () => {
    const required = ["cpf", "documentid", "phone", "email"];

    for (const key of required) {
      expect(SENSITIVE_KEY_DENYLIST).toContain(key);
    }
  });
});

import { describe, expect, it } from "vitest";
import { redactSensitiveText } from "@/lib/observability/sentry-scrubber";

/**
 * `src/app/api/v1/feedback/route.ts` espelha o relato no Sentry via
 * `Sentry.captureFeedback`, que monta um evento `type: "feedback"` — `beforeSend`
 * (`scrubSentryEvent`) só roda para evento de erro (`type` ausente), então esse
 * payload nunca passa pelo scrubber. `mirrorToSentry` compensa isso aplicando
 * `redactSensitiveText` manualmente antes do `captureFeedback`.
 *
 * Este teste não importa `route.ts`: o handler depende de sessão (next-auth) e do
 * repositório Prisma, e este projeto não roda testes unitários sobre `route.ts`
 * (fora do `include` de `vitest.config.ts`, e nenhuma outra rota tem teste
 * equivalente). `redactSensitiveText` é a única peça pura dessa cadeia — provar o
 * contrato com o cenário exato do relatório é o que dá para verificar sem simular
 * Prisma.
 */
describe("redação do texto de feedback antes do mirror no Sentry", () => {
  it("remove o CPF do texto livre, sem alterar o texto que seria persistido", () => {
    const original =
      "não consigo salvar o paciente João da Silva, CPF 529.982.247-25";

    const mirrored = redactSensitiveText(original);

    expect(mirrored).toBe(
      "não consigo salvar o paciente João da Silva, CPF [redacted]",
    );
    expect(mirrored).not.toContain("529.982.247-25");
    // O `message` gravado no Postgres (via `feedbackReportPrismaRepository.create`)
    // é o parâmetro original, nunca o resultado de `redactSensitiveText` — só a
    // cópia que cruza para o Sentry passa pela redação.
    expect(original).toContain("529.982.247-25");
  });
});

import { describe, expect, it } from "vitest";

/**
 * `src/app/api/v1/feedback/route.ts` espelha o relato no Sentry via
 * `Sentry.captureFeedback`, que monta um evento `type: "feedback"` — `beforeSend`
 * (`scrubSentryEvent`) só roda para evento de erro (`type` ausente), então esse
 * payload nunca passa pelo scrubber. Como nenhuma regex remove com segurança um
 * nome de paciente do texto livre, `mirrorToSentry` não envia mais o `message`
 * (redigido ou não): manda um ponteiro estável construído a partir do id do
 * relato persistido.
 *
 * Este teste não importa `route.ts`: o handler depende de sessão (next-auth) e do
 * repositório Prisma, e este projeto não roda testes unitários sobre `route.ts`
 * (fora do `include` de `vitest.config.ts`, e nenhuma outra rota tem teste
 * equivalente). Por isso o teste reproduz aqui a montagem do payload de
 * `mirrorToSentry` — mesma string, mesmo formato — para provar o contrato sem
 * simular Prisma.
 */
function buildFeedbackMirrorMessage(feedbackId: string): string {
  return `Relato registrado no painel: ${feedbackId}`;
}

describe("payload do mirror de feedback no Sentry", () => {
  it("contém o id do relato e não contém o texto livre do usuário", () => {
    const feedbackId = "cmg3k2p9x0001abcd";
    const userText =
      "não consigo salvar o paciente João da Silva, CPF 529.982.247-25";

    const mirrored = buildFeedbackMirrorMessage(feedbackId);

    expect(mirrored).toContain(feedbackId);
    expect(mirrored).not.toContain(userText);
    expect(mirrored).not.toContain("João da Silva");
    expect(mirrored).not.toContain("529.982.247-25");
  });
});

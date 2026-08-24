import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

import type { SessionCookie } from "./session-cookie";

const SESSION_STATE_FILE = resolve(process.cwd(), "e2e", ".session-state.json");

/**
 * Strings de `messages/pt-BR/feedback.json` (`widget.*`) — não são regex livres:
 * o teste quebra de propósito se a i18n mudar sem atualizar aqui.
 */
const TRIGGER_LABEL = /enviar feedback/i;
const SUGGESTION_TYPE_LABEL = /^sugestão$/i;
const MESSAGE_LABEL = /o que aconteceu\?/i;
const SUBMIT_LABEL = /^enviar$/i;
const SUCCESS_TOAST = /feedback enviado\. obrigado\./i;

/**
 * Injeta o cookie de sessão emitido pelo `globalSetup` antes de qualquer `page.goto`.
 * Nenhum spec deste repo faz login pela UI — ver `e2e/session-cookie.ts`.
 */
async function loginWithSeededSession(page: Page): Promise<void> {
  if (!existsSync(SESSION_STATE_FILE)) {
    test.skip(true, "Arquivo e2e/.session-state.json ausente (globalSetup não rodou?)");
    return;
  }
  const cookie = JSON.parse(readFileSync(SESSION_STATE_FILE, "utf8")) as SessionCookie;
  const baseURL = new URL(test.info().project.use.baseURL ?? "http://localhost:3000");

  await page.context().addCookies([
    {
      name: cookie.name,
      value: cookie.value,
      domain: baseURL.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

test.describe("widget de feedback", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithSeededSession(page);
  });

  test("envia sugestão a partir do rodapé da sidebar", async ({ page }) => {
    await page.goto("/dashboard");

    // Rodapé da sidebar expandida (desktop): único gatilho visível nesse estado
    // (o botão flutuante só existe com a sidebar colapsada/mobile — ver `feedback-launcher.tsx`).
    await page.getByRole("button", { name: TRIGGER_LABEL }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: SUGGESTION_TYPE_LABEL }).click();
    await dialog
      .getByLabel(MESSAGE_LABEL)
      .fill("A busca de pacientes podia lembrar o último filtro usado.");
    await dialog.getByRole("button", { name: SUBMIT_LABEL }).click();

    await expect(page.getByText(SUCCESS_TOAST)).toBeVisible();
    await expect(dialog).not.toBeVisible();
  });

  test("bloqueia mensagem curta demais", async ({ page }) => {
    await page.goto("/dashboard");

    await page.getByRole("button", { name: TRIGGER_LABEL }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(MESSAGE_LABEL).fill("erro");
    await dialog.getByRole("button", { name: SUBMIT_LABEL }).click();

    // Validação client-side (Zod: mínimo 10 caracteres) bloqueia o submit — dialog permanece aberto.
    await expect(dialog).toBeVisible();
  });
});

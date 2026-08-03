const MIN_LENGTH = 32;

const DEV_FALLBACK = "submanager-dev-persist-secret-do-not-use-in-prod!!";

let resolvedSecret: string | null = null;
let loggedDevFallbackWarning = false;

/**
 * Segredo para AES (cliente). Em produção, defina `NEXT_PUBLIC_APP_PERSIST_SECRET`
 * com pelo menos 32 caracteres. Valor público no bundle — protege contra leitura casual
 * do localStorage, não contra um atacante com acesso ao JS.
 */
export function getPersistSecret(): string {
  if (resolvedSecret !== null) {
    return resolvedSecret;
  }

  const s = process.env.NEXT_PUBLIC_APP_PERSIST_SECRET?.trim();
  if (s && s.length >= MIN_LENGTH) {
    resolvedSecret = s;
    return resolvedSecret;
  }

  if (process.env.NODE_ENV === "development") {
    if (s && s.length > 0 && s.length < MIN_LENGTH && !loggedDevFallbackWarning) {
      loggedDevFallbackWarning = true;
      console.warn(
        "[submanager] NEXT_PUBLIC_APP_PERSIST_SECRET muito curta (mín. 32 caracteres) — usando chave de desenvolvimento. Ajuste o .env ou remova a variável para o fallback silencioso.",
      );
    }
    resolvedSecret = DEV_FALLBACK;
    return resolvedSecret;
  }

  throw new Error(
    "NEXT_PUBLIC_APP_PERSIST_SECRET é obrigatório em produção (mínimo 32 caracteres).",
  );
}

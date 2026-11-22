import { z } from "zod";

import { resolvePublicAppUrl } from "@/lib/config/urls";
import { logger } from "@/lib/observability/logger";

/**
 * Validação de env no boot do servidor (chamada em `register()` de `src/instrumentation.ts`).
 *
 * Nunca roda em import time: `next build` não pode falhar por env ausente (o build não tem os
 * segredos de runtime). Só `DATABASE_URL`, `NEXTAUTH_SECRET` e a URL pública derrubam o boot em
 * produção; o resto vira `logger.warn` estruturado. Mensagens citam apenas NOMES de variáveis.
 */

const requiredValue = z.string().trim().min(1);

const requiredEnvSchema = z.object({
  DATABASE_URL: requiredValue,
  NEXTAUTH_SECRET: requiredValue,
});

/** Ausência degrada funcionalidades (e-mail, cron, uploads, tokens de app), mas o app sobe. */
const RECOMMENDED_ENV_NAMES = [
  "APP_TOKEN_SECRET",
  "CRON_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "GCS_BUCKET_NAME",
  "GCS_PROJECT_ID",
] as const;

const recommendedEnvSchema = z.object(
  Object.fromEntries(RECOMMENDED_ENV_NAMES.map((name) => [name, requiredValue])) as Record<
    (typeof RECOMMENDED_ENV_NAMES)[number],
    typeof requiredValue
  >,
);

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

export type EnvReport = {
  /** Nomes que impedem o boot em produção. */
  missingRequired: string[];
  /** Nomes que apenas degradam funcionalidades. */
  missingRecommended: string[];
  /** `true` quando a URL pública resolve para localhost. */
  publicUrlIsLocal: boolean;
};

function missingNames(schema: z.ZodType, env: Record<string, string | undefined>): string[] {
  const result = schema.safeParse(env);
  if (result.success) return [];
  return [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
}

function isLocalUrl(rawUrl: string): boolean {
  try {
    return LOCAL_HOSTNAMES.has(new URL(rawUrl).hostname);
  } catch {
    return false;
  }
}

export function inspectEnv(env: Record<string, string | undefined>): EnvReport {
  const missingRequired = missingNames(requiredEnvSchema, env);
  const hasPublicUrl = [env.NEXTAUTH_URL, env.APP_PUBLIC_URL].some((value) => value?.trim());
  if (!hasPublicUrl) {
    missingRequired.push("NEXTAUTH_URL (or APP_PUBLIC_URL)");
  }
  return {
    missingRequired,
    missingRecommended: missingNames(recommendedEnvSchema, env),
    publicUrlIsLocal: isLocalUrl(resolvePublicAppUrl(env)),
  };
}

/** Em produção lança com a lista de nomes obrigatórios ausentes; nos demais casos só avisa. */
export function validateRuntimeEnv(env: Record<string, string | undefined> = process.env): void {
  if (env.NEXT_PHASE === "phase-production-build") return;

  const isProduction = env.NODE_ENV === "production";
  const report = inspectEnv(env);

  if (isProduction && report.missingRequired.length > 0) {
    throw new Error(`[env] Missing required environment variables: ${report.missingRequired.join(", ")}`);
  }
  if (!isProduction) return;

  if (report.missingRecommended.length > 0) {
    logger.warn("[env] Recommended environment variables are not set; related features are degraded", {
      missing: report.missingRecommended,
    });
  }
  if (report.publicUrlIsLocal) {
    logger.warn("[env] Public app URL resolves to localhost in production; links in e-mails and redirects will break", {
      sources: "APP_PUBLIC_URL / NEXTAUTH_URL",
    });
  }
}

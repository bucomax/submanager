import type { ZodError } from "zod";

/**
 * Junta erro de raiz e erro de campo numa mensagem só.
 *
 * Erros de raiz (path vazio) vêm primeiro; erros de campo saem como `campo: mensagem`
 * (campo = primeiro segmento do path, mesmo critério do antigo `flatten()`).
 */
export function formatZodIssues(error: ZodError): string {
  const formIssues = error.issues.filter((issue) => issue.path.length === 0).map((issue) => issue.message);
  const fieldIssues = error.issues
    .filter((issue) => issue.path.length > 0)
    .map((issue) => `${String(issue.path[0])}: ${issue.message}`);
  return [...formIssues, ...fieldIssues].join("; ");
}

import type { ZodError } from "zod";

/**
 * Junta erro de raiz e erro de campo numa mensagem só.
 *
 * `flatten()` manda erro de campo para `fieldErrors` e deixa `formErrors` vazio no
 * caso comum, então ler só `formErrors` — como faz boa parte das rotas antigas deste
 * repo — devolve `""` para praticamente toda rejeição real.
 */
export function formatZodIssues(error: ZodError): string {
  const flat = error.flatten();
  const fieldIssues = Object.entries(flat.fieldErrors).flatMap(([field, issues]) =>
    (issues ?? []).map((issue) => `${field}: ${issue}`),
  );
  return [...flat.formErrors, ...fieldIssues].join("; ");
}

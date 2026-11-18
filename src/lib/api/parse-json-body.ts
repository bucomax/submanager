import type { ZodType, z } from "zod";
import type { ApiT } from "@/lib/api/i18n";
import { jsonError } from "@/lib/api-response";
import { formatZodIssues } from "@/lib/api/zod-error";
import { joinTranslatedZodIssues } from "@/lib/api/zod-i18n";

export type ParseJsonBodyOptions = {
  /**
   * Formato da mensagem de `VALIDATION_ERROR`:
   * - `translated` (padrão): `joinTranslatedZodIssues` (mensagens `@api/...` via `apiT`).
   * - `fields`: `formatZodIssues` (`campo: mensagem`).
   */
  issues?: "translated" | "fields";
  /** Corpo vazio (só espaços) vira `{}`; JSON malformado continua `INVALID_JSON`. */
  allowEmptyBody?: boolean;
};

export type ParsedBody<T> = { data: T; response?: undefined } | { data?: undefined; response: Response };

/** Lê o JSON do request sem validar (rotas com mais de um schema possível): `INVALID_JSON` (400). */
export async function readJsonBody(
  request: Request,
  apiT: ApiT,
  options: Pick<ParseJsonBodyOptions, "allowEmptyBody"> = {},
): Promise<ParsedBody<unknown>> {
  try {
    if (options.allowEmptyBody) {
      const text = await request.text();
      return { data: text.trim() ? (JSON.parse(text) as unknown) : {} };
    }
    return { data: (await request.json()) as unknown };
  } catch {
    return { response: jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400) };
  }
}

/** Lê o JSON do request e valida com Zod: `INVALID_JSON` (400) ou `VALIDATION_ERROR` (422). */
export async function parseJsonBody<S extends ZodType>(
  request: Request,
  schema: S,
  apiT: ApiT,
  options: ParseJsonBodyOptions = {},
): Promise<ParsedBody<z.infer<S>>> {
  const raw = await readJsonBody(request, apiT, options);
  if (raw.response) return { response: raw.response };

  const parsed = schema.safeParse(raw.data);
  if (!parsed.success) {
    const message =
      options.issues === "fields"
        ? formatZodIssues(parsed.error as Parameters<typeof formatZodIssues>[0])
        : joinTranslatedZodIssues(
            parsed.error as Parameters<typeof joinTranslatedZodIssues>[0],
            apiT as (key: string) => string,
          );
    return { response: jsonError("VALIDATION_ERROR", message, 422) };
  }
  return { data: parsed.data as z.infer<S> };
}

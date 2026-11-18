import type { ApiT } from "@/lib/api/i18n";
import { jsonError } from "@/lib/api-response";

export type UseCaseErrorRule = {
  status: number;
  /** Código do envelope (`error.code`). */
  errorCode: string;
  /** Chave completa no namespace `api` (ex.: `errors.appNotFound`). */
  messageKey: string;
};

/** Tabela por domínio: código tipado do use case → resposta HTTP. */
export type UseCaseErrorTable<C extends string> = Readonly<Record<C, UseCaseErrorRule>>;

export type MapUseCaseErrorOptions = {
  /** Mensagem vinda do use case/parceiro; quando presente substitui a tradução da tabela. */
  message?: string | null;
  details?: unknown;
};

/**
 * Converte código de erro tipado de use case em `jsonError` via tabela do domínio.
 * `Record<C, ...>` obriga a tabela a cobrir todos os códigos da union (exaustivo em compile time).
 */
export function mapUseCaseError<C extends string>(
  code: C,
  table: UseCaseErrorTable<C>,
  apiT: ApiT,
  options: MapUseCaseErrorOptions = {},
): Response {
  const rule = table[code];
  const message = options.message ?? apiT(rule.messageKey as Parameters<ApiT>[0]);
  return jsonError(rule.errorCode, message, rule.status, options.details);
}

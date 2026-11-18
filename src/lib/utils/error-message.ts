/** Mensagem legível de um erro desconhecido; usa `fallback` quando não for um `Error`. */
export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

import { timingSafeEqual } from "node:crypto";

/**
 * Compara dois segredos em texto (hash hex, token de verificação) em tempo constante.
 *
 * `timingSafeEqual` exige buffers do mesmo tamanho — a checagem de comprimento vem antes
 * e vaza apenas o tamanho, não o conteúdo.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

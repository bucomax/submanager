import { createHash } from "node:crypto";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Gira a lista para começar num ponto diferente a cada dia (UTC), estável dentro do mesmo dia.
 * Quando o orçamento de tempo do sweep acaba antes do fim da lista, o trecho não verificado muda
 * de um dia para o outro em vez de ser sempre o mesmo final da lista.
 */
export function rotateForDailySweep<T>(items: readonly T[], now: Date): T[] {
  if (items.length <= 1) return [...items];
  const dayIndex = Math.floor(now.getTime() / MS_PER_DAY);
  const hash = createHash("sha256").update(String(dayIndex), "utf8").digest();
  const offset = hash.readUInt32BE(0) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

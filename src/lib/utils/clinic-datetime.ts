/**
 * Datas no fuso das clínicas (Brasília) para lembretes e resumos por e-mail.
 * Funções puras; `now` é parâmetro para facilitar teste.
 */

export const CLINIC_TIMEZONE = "America/Sao_Paulo";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Partes de data (ano, mês, dia) de um instante no fuso da clínica. */
function clinicDateParts(at: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** Diferença (ms) entre o relógio da clínica e UTC naquele instante (negativa para Brasília). */
function clinicOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIMEZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Instante UTC da meia-noite (fuso da clínica) do dia civil `y-m-d`. */
function clinicMidnight(y: number, m: number, d: number): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  return new Date(guess.getTime() - clinicOffsetMs(guess));
}

/** Janela [início, fim) do dia de amanhã no fuso da clínica. */
export function tomorrowWindowInClinicTz(now: Date): { start: Date; end: Date; dayKey: string } {
  const today = clinicDateParts(now);
  const todayMidnight = clinicMidnight(today.y, today.m, today.d);
  const tomorrowParts = clinicDateParts(new Date(todayMidnight.getTime() + MS_PER_DAY + 2 * 60 * 60 * 1000));
  const start = clinicMidnight(tomorrowParts.y, tomorrowParts.m, tomorrowParts.d);
  const afterParts = clinicDateParts(new Date(start.getTime() + MS_PER_DAY + 2 * 60 * 60 * 1000));
  const end = clinicMidnight(afterParts.y, afterParts.m, afterParts.d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { start, end, dayKey: `${tomorrowParts.y}-${pad(tomorrowParts.m)}-${pad(tomorrowParts.d)}` };
}

/** "quarta, 19/11 às 7h30" (minutos omitidos na hora cheia: "às 7h"). */
export function formatSurgeryWhen(at: Date): string {
  const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone: CLINIC_TIMEZONE, weekday: "long" })
    .format(at)
    .replace("-feira", "");
  const date = new Intl.DateTimeFormat("pt-BR", { timeZone: CLINIC_TIMEZONE, day: "2-digit", month: "2-digit" }).format(at);
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: CLINIC_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${weekday}, ${date} às ${hour}h${minute === "00" ? "" : minute}`;
}

/** "45 min", "3 h", "2 h 30 min". */
export function formatSurgeryDuration(totalMin: number): string {
  const min = Math.max(0, Math.round(totalMin));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

/**
 * Semana fechada anterior a `now` (segunda a domingo) no fuso da clínica.
 * - `label`: "10 a 16 de novembro" ou "27 de outubro a 2 de novembro".
 * - `weekKey`: chave estável da semana (data da segunda, `YYYY-MM-DD`).
 * - `start`/`end`: intervalo `[start, end)` em instantes UTC (segunda 00:00 até a segunda seguinte 00:00,
 *   horário da clínica) — o mesmo período do rótulo, para consultar dados sem divergir dele.
 */
export function previousWeekLabelInClinicTz(now: Date): {
  label: string;
  weekKey: string;
  start: Date;
  end: Date;
} {
  const today = clinicDateParts(now);
  const todayUtc = new Date(Date.UTC(today.y, today.m - 1, today.d));
  const dow = (todayUtc.getUTCDay() + 6) % 7; // segunda = 0
  const lastMonday = new Date(todayUtc.getTime() - (dow + 7) * MS_PER_DAY);
  const lastSunday = new Date(lastMonday.getTime() + 6 * MS_PER_DAY);
  const thisMonday = new Date(lastMonday.getTime() + 7 * MS_PER_DAY);
  const month = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long" }).format(d);
  const sameMonth = lastMonday.getUTCMonth() === lastSunday.getUTCMonth();
  const label = sameMonth
    ? `${lastMonday.getUTCDate()} a ${lastSunday.getUTCDate()} de ${month(lastSunday)}`
    : `${lastMonday.getUTCDate()} de ${month(lastMonday)} a ${lastSunday.getUTCDate()} de ${month(lastSunday)}`;
  return {
    label,
    weekKey: lastMonday.toISOString().slice(0, 10),
    start: clinicMidnight(lastMonday.getUTCFullYear(), lastMonday.getUTCMonth() + 1, lastMonday.getUTCDate()),
    end: clinicMidnight(thisMonday.getUTCFullYear(), thisMonday.getUTCMonth() + 1, thisMonday.getUTCDate()),
  };
}

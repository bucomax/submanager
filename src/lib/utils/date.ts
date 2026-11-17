/** Data de hoje no fuso local, formato `YYYY-MM-DD` (uso em `type="date"` / `max`). */
export function todayIsoDateLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDateTime(iso: string, locale = "pt-BR"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDateTimeShort(iso: string, locale = "pt-BR"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function calendarDaysFromNow(iso: string): number {
  const source = new Date(iso);
  if (Number.isNaN(source.getTime())) {
    return 0;
  }

  const from = new Date(source.getFullYear(), source.getMonth(), source.getDate());
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.max(0, Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
}

export function relativeTimeLabel(iso: string, locale = "pt-BR"): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return iso;
  }

  const diffMinutes = Math.floor((Date.now() - then) / 60_000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (diffMinutes < 1) {
    return formatter.format(0, "minute");
  }
  if (diffMinutes < 60) {
    return formatter.format(-diffMinutes, "minute");
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return formatter.format(-diffHours, "hour");
  }

  const diffDays = Math.floor(diffHours / 24);
  return formatter.format(-diffDays, "day");
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listAgendaEvents } from "@/features/agenda/app/services/agenda.service";
import type { AgendaEventDto } from "@/types/api/agenda-v1";

export type AgendaMode = "semana" | "mes";

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // semana começa na segunda
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfMonth(date: Date, monthOffset: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + monthOffset, 1);
}

function endOfMonth(date: Date, monthOffset: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + monthOffset + 1, 1);
}

/** Estado + fetch da tela Agenda — calcula o intervalo `from/to` a partir de modo + offset. */
export function useAgendaEvents() {
  const [mode, setMode] = useState<AgendaMode>("semana");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [events, setEvents] = useState<AgendaEventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { from, to } = useMemo(() => {
    const now = new Date();
    if (mode === "semana") {
      const start = addDays(startOfWeek(now), weekOffset * 7);
      return { from: start, to: addDays(start, 7) };
    }
    return { from: startOfMonth(now, monthOffset), to: endOfMonth(now, monthOffset) };
  }, [mode, weekOffset, monthOffset]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAgendaEvents(from.toISOString(), to.toISOString());
      setEvents(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_error");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function goToday() {
    setWeekOffset(0);
    setMonthOffset(0);
  }

  function goPrevious() {
    if (mode === "semana") setWeekOffset((o) => o - 1);
    else setMonthOffset((o) => o - 1);
  }

  function goNext() {
    if (mode === "semana") setWeekOffset((o) => o + 1);
    else setMonthOffset((o) => o + 1);
  }

  return { mode, setMode, from, to, events, loading, error, refresh, goToday, goPrevious, goNext };
}

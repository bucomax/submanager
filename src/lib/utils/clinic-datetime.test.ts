import { describe, expect, it } from "vitest";

import {
  formatSurgeryDuration,
  formatSurgeryWhen,
  previousWeekLabelInClinicTz,
  tomorrowWindowInClinicTz,
} from "./clinic-datetime";

const iso = (d: Date) => d.toISOString();

describe("tomorrowWindowInClinicTz", () => {
  it("should return the next civil day in the clinic timezone as [start, end)", () => {
    const window = tomorrowWindowInClinicTz(new Date("2026-11-20T15:00:00Z"));

    expect(window.dayKey).toBe("2026-11-21");
    expect(iso(window.start)).toBe("2026-11-21T03:00:00.000Z");
    expect(iso(window.end)).toBe("2026-11-22T03:00:00.000Z");
  });

  it("should still be the clinic's previous day when UTC already rolled over", () => {
    // 02:30Z = 23:30 de 19/11 em Brasília: "amanhã" ainda é 20/11.
    const window = tomorrowWindowInClinicTz(new Date("2026-11-20T02:30:00Z"));

    expect(window.dayKey).toBe("2026-11-20");
    expect(iso(window.start)).toBe("2026-11-20T03:00:00.000Z");
  });

  it("should roll to the next day exactly at clinic midnight", () => {
    const beforeMidnight = tomorrowWindowInClinicTz(new Date("2026-11-20T02:59:59Z"));
    const atMidnight = tomorrowWindowInClinicTz(new Date("2026-11-20T03:00:00Z"));

    expect(beforeMidnight.dayKey).toBe("2026-11-20");
    expect(atMidnight.dayKey).toBe("2026-11-21");
  });

  it("should cross month and year boundaries", () => {
    const window = tomorrowWindowInClinicTz(new Date("2026-12-31T20:00:00Z"));

    expect(window.dayKey).toBe("2027-01-01");
    expect(iso(window.start)).toBe("2027-01-01T03:00:00.000Z");
    expect(iso(window.end)).toBe("2027-01-02T03:00:00.000Z");
  });

  it("should include an evening surgery whose UTC date is already the following day", () => {
    const { start, end } = tomorrowWindowInClinicTz(new Date("2026-11-20T21:00:00Z"));
    const surgeryAt22hLocal = new Date("2026-11-22T01:00:00Z"); // 22h de 21/11 em Brasília
    const nextDayMidnightLocal = new Date("2026-11-22T03:00:00Z");

    expect(surgeryAt22hLocal >= start && surgeryAt22hLocal < end).toBe(true);
    expect(nextDayMidnightLocal < end).toBe(false);
  });
});

describe("previousWeekLabelInClinicTz", () => {
  it("should label the closed Monday-to-Sunday week and expose the matching [start, end) range", () => {
    // Segunda 08h em Brasília.
    const week = previousWeekLabelInClinicTz(new Date("2026-11-23T11:00:00Z"));

    expect(week.label).toBe("16 a 22 de novembro");
    expect(week.weekKey).toBe("2026-11-16");
    expect(iso(week.start)).toBe("2026-11-16T03:00:00.000Z");
    expect(iso(week.end)).toBe("2026-11-23T03:00:00.000Z");
  });

  it("should treat Sunday night in the clinic timezone as still inside the current week", () => {
    // 02:00Z de segunda = 23h de domingo em Brasília: a semana fechada anterior ainda é 9 a 15.
    const week = previousWeekLabelInClinicTz(new Date("2026-11-23T02:00:00Z"));

    expect(week.weekKey).toBe("2026-11-09");
    expect(week.label).toBe("9 a 15 de novembro");
    expect(iso(week.end)).toBe("2026-11-16T03:00:00.000Z");
  });

  it("should cover exactly 7 days and label a range that crosses months", () => {
    const week = previousWeekLabelInClinicTz(new Date("2026-11-03T11:00:00Z"));

    expect(week.label).toBe("26 de outubro a 1 de novembro");
    expect(week.weekKey).toBe("2026-10-26");
    expect(week.end.getTime() - week.start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("should keep the range aligned with the label for any weekday of the following week", () => {
    const ends = [23, 24, 25, 26, 27, 28, 29].map((day) =>
      iso(previousWeekLabelInClinicTz(new Date(`2026-11-${day}T15:00:00Z`)).end),
    );

    expect(new Set(ends)).toEqual(new Set(["2026-11-23T03:00:00.000Z"]));
  });
});

describe("surgery formatting", () => {
  it("should format weekday, date and hour in the clinic timezone, omitting minutes on the hour", () => {
    expect(formatSurgeryWhen(new Date("2026-11-25T10:00:00Z"))).toBe("quarta, 25/11 às 7h");
    expect(formatSurgeryWhen(new Date("2026-11-25T10:30:00Z"))).toBe("quarta, 25/11 às 7h30");
  });

  it("should format durations", () => {
    expect(formatSurgeryDuration(45)).toBe("45 min");
    expect(formatSurgeryDuration(180)).toBe("3 h");
    expect(formatSurgeryDuration(150)).toBe("2 h 30 min");
  });
});

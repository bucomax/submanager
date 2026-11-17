import { describe, expect, it } from "vitest";

import { diffChecklistItems } from "./checklist-diff";

const d = (label: string, sortOrder: number, requiredForTransition = false) => ({
  label,
  sortOrder,
  requiredForTransition,
});

describe("diffChecklistItems", () => {
  it("should keep ids of unchanged items and only update order/required", () => {
    const diff = diffChecklistItems(
      [
        { id: "a", label: "Exame", sortOrder: 0 },
        { id: "b", label: "Termo", sortOrder: 1 },
      ],
      [d("Termo", 0, true), d("Exame", 1)],
    );
    expect(diff.update).toEqual([
      { id: "b", ...d("Termo", 0, true) },
      { id: "a", ...d("Exame", 1) },
    ]);
    expect(diff.create).toEqual([]);
    expect(diff.deleteIds).toEqual([]);
  });

  it("should create new and delete only removed items", () => {
    const diff = diffChecklistItems(
      [
        { id: "a", label: "Exame", sortOrder: 0 },
        { id: "b", label: "Termo", sortOrder: 1 },
      ],
      [d("Exame", 0), d("Novo", 1)],
    );
    expect(diff.update.map((u) => u.id)).toEqual(["a"]);
    expect(diff.create).toEqual([d("Novo", 1)]);
    expect(diff.deleteIds).toEqual(["b"]);
  });

  it("should pair duplicate labels by sortOrder", () => {
    const diff = diffChecklistItems(
      [
        { id: "a", label: "X", sortOrder: 0 },
        { id: "b", label: "X", sortOrder: 1 },
      ],
      [d("X", 0)],
    );
    expect(diff.update.map((u) => u.id)).toEqual(["a"]);
    expect(diff.deleteIds).toEqual(["b"]);
  });
});

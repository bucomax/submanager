export type ExistingChecklistItem = { id: string; label: string; sortOrder: number };
export type DesiredChecklistItem = {
  label: string;
  sortOrder: number;
  requiredForTransition: boolean;
};

export type ChecklistDiff = {
  update: ({ id: string } & DesiredChecklistItem)[];
  create: DesiredChecklistItem[];
  deleteIds: string[];
};

/**
 * Compara itens existentes de uma etapa com os desejados (graphJson).
 * Chave estável: label (trim). Itens duplicados com mesmo label são pareados por sortOrder.
 * Itens casados são atualizados no lugar (preserva `PatientPathwayChecklistItem`);
 * só itens removidos do grafo são deletados.
 */
export function diffChecklistItems(
  existing: ExistingChecklistItem[],
  desired: DesiredChecklistItem[],
): ChecklistDiff {
  const pool = new Map<string, ExistingChecklistItem[]>();
  for (const item of [...existing].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const key = item.label.trim();
    pool.set(key, [...(pool.get(key) ?? []), item]);
  }

  const update: ChecklistDiff["update"] = [];
  const create: DesiredChecklistItem[] = [];
  for (const item of [...desired].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const match = pool.get(item.label.trim())?.shift();
    if (match) update.push({ id: match.id, ...item });
    else create.push(item);
  }

  const deleteIds = [...pool.values()].flat().map((item) => item.id);
  return { update, create, deleteIds };
}

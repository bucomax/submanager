import type { Prisma, PrismaClient } from "@prisma/client";

import type { StageDocumentBundleItem } from "@/domain/pathway/stage-document-bundle";

/** Documentos da etapa em ordem de `sortOrder` (pacote entregue ao paciente ao entrar na etapa). */
export async function getStageDocumentBundleFrom(
  db: PrismaClient | Prisma.TransactionClient,
  pathwayStageId: string,
): Promise<StageDocumentBundleItem[]> {
  const rows = await db.stageDocument.findMany({
    where: { pathwayStageId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      sortOrder: true,
      fileAsset: { select: { id: true, fileName: true, mimeType: true, r2Key: true } },
    },
  });
  return rows.map((row) => ({
    stageDocumentId: row.id,
    sortOrder: row.sortOrder,
    file: row.fileAsset,
  }));
}

import {
  getPathway,
  getPathwayVersion,
  postPathwayVersion,
} from "@/features/pathways/app/services/pathways.service";
import type { PathwayVersionDetail } from "@/features/pathways/app/types/pathways";
import type { PathwayEditorState } from "@/features/pathways/app/types/pathway-editor";
import { createDefaultPathwayGraph } from "@/features/pathways/app/utils/default-graph";
import type { RequestOptions } from "@/types/api/request-options";

type VersionToEdit = { versionId: string; versionNumber: number; graphJson: unknown };

/**
 * Carrega o fluxo para o editor. Quem gerencia edita o rascunho mais recente — criado a partir da
 * publicada (ou de um grafo vazio) se não existir. Somente leitura nunca cria versão (a API retorna 403).
 */
export async function loadPathwayEditorState(
  pathwayId: string,
  canManage: boolean,
  noVersionToViewMessage: string,
  options?: RequestOptions,
): Promise<PathwayEditorState> {
  const pathway = await getPathway(pathwayId, options);
  const publishedSorted = pathway.versions
    .filter((version) => version.published)
    .sort((a, b) => b.version - a.version);

  let publishedDetail: PathwayVersionDetail | null = null;
  if (publishedSorted[0]) {
    publishedDetail = await getPathwayVersion(pathwayId, publishedSorted[0].id, options);
  }
  const drafts = pathway.versions.filter((version) => !version.published).sort((a, b) => b.version - a.version);

  let target: VersionToEdit;
  if (!canManage) {
    const viewable =
      publishedDetail ?? (drafts[0] ? await getPathwayVersion(pathwayId, drafts[0].id, options) : null);
    if (!viewable) {
      throw new Error(noVersionToViewMessage);
    }
    target = { versionId: viewable.id, versionNumber: viewable.version, graphJson: viewable.graphJson };
  } else if (drafts[0]) {
    const detail = await getPathwayVersion(pathwayId, drafts[0].id, options);
    target = { versionId: drafts[0].id, versionNumber: detail.version, graphJson: detail.graphJson };
  } else {
    const graphJson = publishedDetail ? publishedDetail.graphJson : createDefaultPathwayGraph();
    const created = await postPathwayVersion(pathwayId, graphJson);
    target = { versionId: created.id, versionNumber: created.version, graphJson };
  }

  return {
    ...target,
    pathwayName: pathway.name,
    publishedGraphSnapshot: publishedDetail?.graphJson ?? null,
  };
}

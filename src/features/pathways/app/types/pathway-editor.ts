/** Estado carregado do editor de fluxo: versão em edição + snapshot da última publicada. */
export type PathwayEditorState = {
  versionId: string;
  versionNumber: number;
  graphJson: unknown;
  /** Nome conforme o último carregamento ou salvamento bem-sucedido. */
  pathwayName: string;
  /** Grafo da versão publicada mais recente (para comparar com o rascunho salvo). */
  publishedGraphSnapshot: unknown | null;
};

export type StageDocumentBundleItem = {
  stageDocumentId: string;
  sortOrder: number;
  file: {
    id: string;
    fileName: string;
    mimeType: string;
    r2Key: string;
  };
};

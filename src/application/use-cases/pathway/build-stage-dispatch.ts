import { randomUUID } from "crypto";

import type { StageDocumentBundleItem } from "@/domain/pathway/stage-document-bundle";

export type { StageDocumentBundleItem };

export function buildStageDispatchStub(input: {
  tenantId: string;
  clientId: string;
  stageId: string;
  stageName: string;
  documents: StageDocumentBundleItem[];
}) {
  return {
    event: "patient.stage_changed",
    correlationId: randomUUID(),
    channel: "whatsapp_stub",
    dispatchStatus: "pending_stub",
    ...input,
  };
}

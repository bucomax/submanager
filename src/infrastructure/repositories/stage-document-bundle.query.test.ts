import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { getStageDocumentBundleFrom } from "./stage-document-bundle.query";

describe("getStageDocumentBundleFrom", () => {
  it("should only bundle library files (clientId null), never patient files", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "sd1", sortOrder: 0, fileAsset: { id: "f1", fileName: "termo.pdf", mimeType: "application/pdf", r2Key: "k1" } },
    ]);
    const db = { stageDocument: { findMany } } as unknown as PrismaClient;

    const bundle = await getStageDocumentBundleFrom(db, "stage-1");

    expect(findMany.mock.calls[0]![0].where).toEqual({ pathwayStageId: "stage-1", fileAsset: { clientId: null } });
    expect(bundle).toEqual([
      {
        stageDocumentId: "sd1",
        sortOrder: 0,
        file: { id: "f1", fileName: "termo.pdf", mimeType: "application/pdf", r2Key: "k1" },
      },
    ]);
  });
});

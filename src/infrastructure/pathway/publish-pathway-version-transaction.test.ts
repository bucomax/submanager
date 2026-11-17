import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { runPublishPathwayVersionTransaction } from "./publish-pathway-version-transaction";

type FakeOptions = {
  targetPublished?: boolean;
  oldStages?: { id: string; stageKey: string; name: string; _count: { currentPatients: number } }[];
};

function makeTx({ targetPublished = false, oldStages = [] }: FakeOptions) {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    pathwayVersion: {
      findFirst: vi
        .fn()
        .mockResolvedValueOnce({ published: targetPublished })
        .mockResolvedValueOnce(oldStages.length ? { id: "v-old", stages: oldStages } : null),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    pathwayStage: {
      findMany: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    stageTransition: { deleteMany: vi.fn() },
  };
  return tx;
}

const stageInput = {
  stageKey: "a",
  name: "A",
  sortOrder: 0,
  patientMessage: null,
  alertWarningDays: null,
  alertCriticalDays: null,
  defaultAssigneeUserId: null,
  defaultAssigneeUserIds: [],
  checklistItems: [],
  documentFileAssetIds: [],
};

const baseInput = { tenantId: "t", pathwayId: "p", versionId: "v-new", stages: [stageInput] };

describe("runPublishPathwayVersionTransaction", () => {
  it("should take the pathway advisory lock and reject an already published version", async () => {
    const tx = makeTx({ targetPublished: true });
    const result = await runPublishPathwayVersionTransaction(tx as unknown as Prisma.TransactionClient, baseInput);
    expect(result).toEqual({ ok: false, code: "ALREADY_PUBLISHED" });
    expect(tx.$executeRaw).toHaveBeenCalledOnce();
    expect(tx.pathwayVersion.update).not.toHaveBeenCalled();
  });

  it("should reject removing stages that still have patients without deleting anything", async () => {
    const tx = makeTx({
      oldStages: [{ id: "s-old", stageKey: "gone", name: "Gone", _count: { currentPatients: 2 } }],
    });
    const result = await runPublishPathwayVersionTransaction(tx as unknown as Prisma.TransactionClient, baseInput);
    expect(result).toEqual({
      ok: false,
      code: "REMOVED_STAGES_WITH_PATIENTS",
      stages: [{ stageKey: "gone", name: "Gone", patientCount: 2 }],
    });
    expect(tx.pathwayStage.delete).not.toHaveBeenCalled();
    expect(tx.stageTransition.deleteMany).not.toHaveBeenCalled();
  });
});

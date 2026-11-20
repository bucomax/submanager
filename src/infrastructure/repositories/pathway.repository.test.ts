import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  pathwayStage: { findFirst: vi.fn() },
  fileAsset: { findFirst: vi.fn() },
  stageDocument: { findFirst: vi.fn(), aggregate: vi.fn(), create: vi.fn() },
}));
vi.mock("@/infrastructure/database/prisma", () => ({ prisma: prismaMock }));

const { pathwayPrismaRepository } = await import("./pathway.repository");

describe("pathwayPrismaRepository.linkStageDocument", () => {
  const params = { tenantId: "t1", pathwayStageId: "stage-1", fileAssetId: "file-1" };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.pathwayStage.findFirst.mockResolvedValue({ id: "stage-1" });
  });

  it("should only look up library files of the tenant (clientId null)", async () => {
    prismaMock.fileAsset.findFirst.mockResolvedValue(null);

    const result = await pathwayPrismaRepository.linkStageDocument(params);

    expect(prismaMock.fileAsset.findFirst.mock.calls[0]![0].where).toEqual({
      id: "file-1",
      tenantId: "t1",
      clientId: null,
    });
    expect(result).toEqual({ ok: false, code: "FILE_NOT_FOUND" });
    expect(prismaMock.stageDocument.create).not.toHaveBeenCalled();
  });

  it("should link a library file", async () => {
    prismaMock.fileAsset.findFirst.mockResolvedValue({ id: "file-1" });
    prismaMock.stageDocument.findFirst.mockResolvedValue(null);
    prismaMock.stageDocument.aggregate.mockResolvedValue({ _max: { sortOrder: null } });
    prismaMock.stageDocument.create.mockResolvedValue({
      id: "sd1",
      sortOrder: 0,
      fileAsset: { id: "file-1", fileName: "termo.pdf", mimeType: "application/pdf" },
    });

    const result = await pathwayPrismaRepository.linkStageDocument(params);

    expect(result).toMatchObject({ ok: true, stageDocument: { id: "sd1", sortOrder: 0 } });
  });
});

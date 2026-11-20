import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WhatsAppDispatchInput } from "@/application/ports/whatsapp-dispatcher.port";

type Row = {
  id: string;
  tenantId: string;
  stageTransitionId: string;
  channel: string;
  status: string;
  externalMessageId?: string;
  documentFileName?: string | null;
  documentR2Key?: string | null;
  [key: string]: unknown;
};

const db = vi.hoisted(() => ({ rows: [] as Row[], nextId: 1 }));
const mocks = vi.hoisted(() => ({
  sendDocument: vi.fn(),
  sendInteractive: vi.fn(),
  presign: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn(async () => ({
        whatsappEnabled: true,
        whatsappPhoneNumberId: "phone-1",
        whatsappAccessTokenEnc: "enc",
      })),
    },
    channelDispatch: {
      findMany: vi.fn(
        async ({ where }: { where: { tenantId: string; stageTransitionId: string; status: { in: string[] } } }) =>
          db.rows.filter(
            (r) =>
              r.tenantId === where.tenantId &&
              r.stageTransitionId === where.stageTransitionId &&
              where.status.in.includes(r.status),
          ),
      ),
      create: vi.fn(async ({ data }: { data: Omit<Row, "id"> }) => {
        const row = { documentFileName: null, documentR2Key: null, ...data, id: `cd-${db.nextId++}` } as Row;
        db.rows.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where }: { where: { tenantId: string; externalMessageId: string } }) =>
        db.rows.find((r) => r.tenantId === where.tenantId && r.externalMessageId === where.externalMessageId) ?? null,
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        Object.assign(db.rows.find((r) => r.id === where.id)!, data);
      }),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
  },
}));
vi.mock("@/infrastructure/crypto/tenant-secret", () => ({ decryptTenantSecret: () => "token" }));
vi.mock("@/infrastructure/storage/gcs-storage", () => ({ presignGetObject: mocks.presign }));
vi.mock("@/infrastructure/whatsapp/whatsapp-cloud-client", () => ({
  sendDocumentMessage: mocks.sendDocument,
  sendInteractiveButtonMessage: mocks.sendInteractive,
  getPhoneNumberInfo: vi.fn(),
}));
vi.mock("@/infrastructure/repositories/audit-event.repository", () => ({
  auditEventPrismaRepository: { recordCanonical: mocks.audit },
}));
vi.mock("@/lib/observability/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { whatsappDispatcher } = await import("./whatsapp-dispatcher");
const { prisma } = await import("@/infrastructure/database/prisma");

const input: WhatsAppDispatchInput = {
  tenantId: "t1",
  stageTransitionId: "tr1",
  clientId: "c1",
  recipientPhone: "5511999999999",
  stageName: "Pré-operatório",
  documents: [
    { fileName: "termo.pdf", r2Key: "tenants/t1/termo.pdf", mimeType: "application/pdf" },
    { fileName: "exames.pdf", r2Key: "tenants/t1/exames.pdf", mimeType: "application/pdf" },
  ],
};

const sentFileNames = () => mocks.sendDocument.mock.calls.map((call) => call[4] as string);
const summaryText = () => mocks.sendInteractive.mock.calls[0]?.[3] as string | undefined;

function seedSent(documentR2Key: string | null, status = "SENT", tenantId = "t1") {
  db.rows.push({
    id: `seed-${db.nextId++}`,
    tenantId,
    stageTransitionId: "tr1",
    channel: "WHATSAPP",
    status,
    documentR2Key,
    documentFileName: documentR2Key ? "x.pdf" : null,
  });
}

describe("whatsappDispatcher.dispatch", () => {
  beforeEach(() => {
    db.rows = [];
    db.nextId = 1;
    mocks.sendDocument.mockReset().mockImplementation(async () => `wamid-doc-${db.nextId++}`);
    mocks.sendInteractive.mockReset().mockResolvedValue("wamid-summary");
    mocks.presign.mockReset().mockResolvedValue("https://signed.test/doc");
    mocks.audit.mockReset().mockResolvedValue(undefined);
  });

  it("should send every document and then a summary counting them", async () => {
    const result = await whatsappDispatcher.dispatch(input);

    expect(sentFileNames()).toEqual(["termo.pdf", "exames.pdf"]);
    expect(summaryText()).toContain("Você recebeu 2 documento(s)");
    expect(result.dispatchIds).toHaveLength(3);
  });

  it("should skip documents already sent for the same transition on retry and count them in the summary", async () => {
    seedSent("tenants/t1/termo.pdf");

    await whatsappDispatcher.dispatch(input);

    expect(sentFileNames()).toEqual(["exames.pdf"]);
    expect(summaryText()).toContain("Você recebeu 2 documento(s)");
  });

  it("should treat documents already delivered or read as sent", async () => {
    seedSent("tenants/t1/termo.pdf", "READ");
    seedSent("tenants/t1/exames.pdf", "DELIVERED");
    seedSent(null); // resumo também já enviado

    const result = await whatsappDispatcher.dispatch(input);

    expect(mocks.sendDocument).not.toHaveBeenCalled();
    expect(mocks.sendInteractive).not.toHaveBeenCalled();
    expect(result.dispatchIds).toEqual([]);
  });

  it("should resend a document whose previous attempt failed", async () => {
    seedSent("tenants/t1/termo.pdf", "FAILED");

    await whatsappDispatcher.dispatch(input);

    expect(sentFileNames()).toEqual(["termo.pdf", "exames.pdf"]);
  });

  it("should not reuse sent history from another transition or tenant", async () => {
    seedSent("tenants/t1/termo.pdf", "SENT", "other-tenant");
    db.rows.push({ id: "x", tenantId: "t1", stageTransitionId: "tr-other", channel: "WHATSAPP", status: "SENT", documentR2Key: "tenants/t1/termo.pdf" });

    await whatsappDispatcher.dispatch(input);

    expect(sentFileNames()).toEqual(["termo.pdf", "exames.pdf"]);
  });

  it("should count only documents that actually left in the summary", async () => {
    mocks.sendDocument
      .mockResolvedValueOnce("wamid-1")
      .mockRejectedValueOnce(new Error("[WhatsApp API] 131026: undeliverable"));

    await whatsappDispatcher.dispatch(input);

    expect(summaryText()).toContain("Você recebeu 1 documento(s)");
    expect(db.rows.filter((r) => r.status === "FAILED")).toHaveLength(1);
  });

  it("should not send the summary when no document left", async () => {
    mocks.sendDocument.mockRejectedValue(new Error("[WhatsApp API] 131000: down"));

    const result = await whatsappDispatcher.dispatch(input);

    expect(mocks.sendInteractive).not.toHaveBeenCalled();
    expect(db.rows.every((r) => r.status === "FAILED")).toBe(true);
    expect(result.dispatchIds).toHaveLength(2);
  });

  it("should not send the summary twice across retries", async () => {
    mocks.sendDocument.mockResolvedValueOnce("wamid-1").mockRejectedValueOnce(new Error("timeout"));
    await whatsappDispatcher.dispatch(input);
    expect(mocks.sendInteractive).toHaveBeenCalledTimes(1);

    mocks.sendDocument.mockResolvedValue("wamid-2");
    await whatsappDispatcher.dispatch(input);

    expect(mocks.sendInteractive).toHaveBeenCalledTimes(1);
    expect(sentFileNames()).toEqual(["termo.pdf", "exames.pdf", "exames.pdf"]);
  });

  it("should record a FAILED dispatch when only the summary fails", async () => {
    mocks.sendInteractive.mockRejectedValue(new Error("button rejected"));

    await whatsappDispatcher.dispatch(input);

    const summaryRows = db.rows.filter((r) => r.documentR2Key === null);
    expect(summaryRows).toHaveLength(1);
    expect(summaryRows[0]!.status).toBe("FAILED");
  });
});

describe("whatsappDispatcher webhooks (tenant isolation)", () => {
  beforeEach(() => {
    db.rows = [];
    vi.mocked(prisma.channelDispatch.updateMany).mockClear();
    vi.mocked(prisma.channelDispatch.update).mockClear();
    mocks.audit.mockReset().mockResolvedValue(undefined);
  });

  const status = (tenantId: string) => ({
    tenantId,
    externalMessageId: "wamid-1",
    status: "delivered" as const,
    timestamp: "1700000000",
  });

  it("should apply a status update only inside the tenant that owns the number", async () => {
    db.rows.push({ id: "cd-1", tenantId: "t1", stageTransitionId: "tr1", channel: "WHATSAPP", status: "SENT", externalMessageId: "wamid-1" });

    await whatsappDispatcher.handleStatusUpdate(status("other-tenant"));
    expect(prisma.channelDispatch.update).not.toHaveBeenCalled();

    await whatsappDispatcher.handleStatusUpdate(status("t1"));
    expect(prisma.channelDispatch.update).toHaveBeenCalledTimes(1);
    expect(db.rows[0]!.status).toBe("DELIVERED");
  });

  it("should confirm a transition only for the tenant that owns the number, scoping the sibling update too", async () => {
    db.rows.push({ id: "cd-1", tenantId: "t1", stageTransitionId: "tr1", channel: "WHATSAPP", status: "SENT", externalMessageId: "wamid-summary" });
    const reply = (tenantId: string) => ({
      tenantId,
      externalMessageId: "wamid-summary",
      buttonPayload: "received",
      timestamp: "1700000000",
    });

    await whatsappDispatcher.handleButtonReply(reply("other-tenant"));
    expect(prisma.channelDispatch.update).not.toHaveBeenCalled();

    await whatsappDispatcher.handleButtonReply(reply("t1"));
    expect(db.rows[0]!.status).toBe("CONFIRMED");
    expect(vi.mocked(prisma.channelDispatch.updateMany).mock.calls[0]![0]).toMatchObject({
      where: { tenantId: "t1", stageTransitionId: "tr1" },
    });
  });
});

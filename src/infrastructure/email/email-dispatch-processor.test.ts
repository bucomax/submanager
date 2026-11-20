import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EmailDispatchJobPayload } from "@/infrastructure/queue/email-dispatch-job-types";

const USERS = [
  { id: "u1", name: "Ana", email: "ana@clinic.test" },
  { id: "u2", name: "Beto", email: "beto@clinic.test" },
  { id: "u3", name: "Caio", email: null },
];

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  canSend: vi.fn(),
  filterVisible: vi.fn(),
  keys: new Set<string>(),
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        USERS.filter((u) => where.id.in.includes(u.id)),
      ),
    },
    emailDispatchLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));
vi.mock("@/infrastructure/database/dispatch-key", () => ({
  hasDispatchKey: vi.fn(async (key: string) => mocks.keys.has(key)),
  reserveDispatchKey: vi.fn(async (key: string) => {
    if (mocks.keys.has(key)) return false;
    mocks.keys.add(key);
    return true;
  }),
}));
vi.mock("@/infrastructure/email/resend.client", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/infrastructure/email/email-availability", () => ({ canSendEmailForTenant: mocks.canSend }));
vi.mock("@/infrastructure/email/resolve-tenant-sender", () => ({
  resolveTenantSender: vi.fn().mockResolvedValue({ from: "Clinica <no-reply@clinic.test>", useSmtp: false }),
}));
vi.mock("@/infrastructure/visibility/client-visibility-scope", () => ({
  filterUserIdsWhoCanViewClient: mocks.filterVisible,
}));
vi.mock("@/lib/config/urls", () => ({ getPublicAppUrl: () => "https://app.test/" }));
vi.mock("@/lib/observability/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { processEmailDispatchJob } = await import("./email-dispatch-processor");
const { EmailDispatchRetryableError, EmailSendError } = await import("./email-send-error");

const slaAlert = (targetUserIds = ["u1", "u2"]): EmailDispatchJobPayload => ({
  kind: "sla_alert",
  tenantId: "t1",
  data: {
    severity: "danger",
    patientName: "Maria",
    stageName: "Pré-operatório",
    daysInStage: 12,
    slaThresholdDays: 10,
    clientId: "c1",
    targetUserIds,
    clinicName: "Clínica Sorriso",
  },
});

const weeklyReport = (): EmailDispatchJobPayload => ({
  kind: "weekly_report_staff",
  tenantId: "t1",
  data: {
    periodLabel: "16 a 22 de novembro",
    kpis: { patients: 3, transitions: 5, critical: 1, pathways: 1 },
    byStatus: { ok: 1, warning: 1, danger: 1 },
    topStages: [{ label: "Pré-operatório", count: 2 }],
    critical: [{ clientId: "c1", name: "Maria", stageName: "Pré-operatório", daysInStage: 12 }],
    criticalTotal: 1,
    targetUserIds: ["u1", "u2"],
    clinicName: "Clínica Sorriso",
  },
});

const sentTo = () => mocks.sendEmail.mock.calls.map(([arg]) => (arg as { to: string }).to);

describe("processEmailDispatchJob", () => {
  beforeEach(() => {
    mocks.sendEmail.mockReset();
    mocks.sendEmail.mockResolvedValue({ id: "msg-1" });
    mocks.canSend.mockReset();
    mocks.canSend.mockResolvedValue(true);
    mocks.filterVisible.mockReset();
    mocks.filterVisible.mockImplementation(async (_t: string, _c: string, ids: string[]) => ids);
    mocks.keys.clear();
  });

  it("should throw a retryable error when a recipient fails transiently, after trying everyone", async () => {
    mocks.sendEmail
      .mockResolvedValueOnce({ error: new EmailSendError("429", true) })
      .mockResolvedValueOnce({ id: "msg-2" });

    await expect(processEmailDispatchJob(slaAlert())).rejects.toBeInstanceOf(EmailDispatchRetryableError);

    expect(sentTo()).toEqual(["ana@clinic.test", "beto@clinic.test"]);
  });

  it("should not throw for permanent failures (retrying would not help)", async () => {
    mocks.sendEmail.mockResolvedValue({ error: new EmailSendError("invalid address", false) });

    await expect(processEmailDispatchJob(slaAlert())).resolves.toBeUndefined();
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
  });

  it("should treat unclassified send errors as permanent", async () => {
    mocks.sendEmail.mockResolvedValue({ error: new Error("SMTP não configurado") });

    await expect(processEmailDispatchJob(slaAlert())).resolves.toBeUndefined();
  });

  it("should not resend to recipients already sent in a previous attempt of the same job", async () => {
    const runKey = "job-1:1700000000000";
    mocks.sendEmail
      .mockResolvedValueOnce({ id: "msg-1" })
      .mockResolvedValueOnce({ error: new EmailSendError("503", true) });

    await expect(processEmailDispatchJob(slaAlert(), { runKey })).rejects.toBeInstanceOf(
      EmailDispatchRetryableError,
    );
    mocks.sendEmail.mockReset();
    mocks.sendEmail.mockResolvedValue({ id: "msg-3" });
    await expect(processEmailDispatchJob(slaAlert(), { runKey })).resolves.toBeUndefined();

    expect(sentTo()).toEqual(["beto@clinic.test"]);
  });

  it("should not share sent markers between different job instances with the same job id", async () => {
    await processEmailDispatchJob(slaAlert(), { runKey: "job-1:111" });
    mocks.sendEmail.mockClear();

    await processEmailDispatchJob(slaAlert(), { runKey: "job-1:222" });

    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
  });

  it("should not track recipients in inline mode (no runKey, no retry)", async () => {
    await processEmailDispatchJob(slaAlert());

    expect(mocks.keys.size).toBe(0);
    expect(mocks.sendEmail.mock.calls.every(([arg]) => (arg as { idempotencyKey?: string }).idempotencyKey === undefined)).toBe(true);
  });

  it("should send a stable provider idempotency key per recipient when running under a worker", async () => {
    await processEmailDispatchJob(slaAlert(["u1"]), { runKey: "job-1:1" });
    await processEmailDispatchJob(slaAlert(["u1"]), { runKey: "job-1:1" });

    // 2ª execução pula o destinatário (já marcado), então só a 1ª enviou, com chave sha256 (hex).
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmail.mock.calls[0]![0].idempotencyKey).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should only email staff who can view the patient (LGPD), using one central filter", async () => {
    mocks.filterVisible.mockResolvedValue(["u2"]);

    await processEmailDispatchJob(slaAlert(["u1", "u2"]));

    expect(mocks.filterVisible).toHaveBeenCalledWith("t1", "c1", ["u1", "u2"]);
    expect(sentTo()).toEqual(["beto@clinic.test"]);
  });

  it("should send nothing when nobody can view the patient", async () => {
    mocks.filterVisible.mockResolvedValue([]);

    await processEmailDispatchJob(slaAlert());

    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("should not apply the patient visibility filter to tenant-wide reports", async () => {
    await processEmailDispatchJob(weeklyReport());

    expect(mocks.filterVisible).not.toHaveBeenCalled();
    expect(sentTo()).toEqual(["ana@clinic.test", "beto@clinic.test"]);
  });

  it("should skip staff without an email address", async () => {
    await processEmailDispatchJob(slaAlert(["u3", "u1"]));

    expect(sentTo()).toEqual(["ana@clinic.test"]);
  });

  it("should do nothing when the tenant cannot send email", async () => {
    mocks.canSend.mockResolvedValue(false);

    await processEmailDispatchJob(slaAlert());

    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("should send the stage transition email to the patient and retry only on transient failures", async () => {
    const payload: EmailDispatchJobPayload = {
      kind: "stage_transition_patient",
      tenantId: "t1",
      to: "paciente@mail.test",
      data: {
        patientName: "Maria",
        stageName: "Cirurgia",
        patientMessage: null,
        documents: [{ fileName: "termo.pdf" }],
        portalUrl: "https://app.test/clinica/patient/login",
        clinicName: "Clínica Sorriso",
      },
    };

    await processEmailDispatchJob(payload);
    expect(sentTo()).toEqual(["paciente@mail.test"]);
    expect(mocks.filterVisible).not.toHaveBeenCalled();

    mocks.sendEmail.mockResolvedValue({ error: new EmailSendError("timeout", true) });
    await expect(processEmailDispatchJob(payload)).rejects.toBeInstanceOf(EmailDispatchRetryableError);
  });

  it("should word document delivery as dispatched, not delivered, unless there is no channel", async () => {
    const payload = (emailTo: string | null): EmailDispatchJobPayload => ({
      kind: "document_delivery_staff",
      tenantId: "t1",
      data: {
        patientName: "Maria",
        clientId: "c1",
        stageName: "Cirurgia",
        documents: ["termo.pdf"],
        emailTo,
        whatsappTo: null,
        targetUserIds: ["u1"],
        clinicName: "Clínica Sorriso",
      },
    });

    await processEmailDispatchJob(payload("m***@mail.test"));
    await processEmailDispatchJob(payload(null));

    const subjects = mocks.sendEmail.mock.calls.map(([arg]) => (arg as { subject: string }).subject);
    expect(subjects[0]).toContain("Documentos disparados");
    expect(subjects[1]).toContain("Documentos não enviados");
  });
});

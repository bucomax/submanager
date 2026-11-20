import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EmailDispatchJobPayload } from "@/infrastructure/queue/email-dispatch-job-types";

const mocks = vi.hoisted(() => ({
  keys: new Set<string>(),
  canSend: vi.fn(),
  queueAvailable: vi.fn(),
  tripCircuit: vi.fn(),
  queueAdd: vi.fn(),
  getQueue: vi.fn(),
  process: vi.fn(),
}));

vi.mock("@/infrastructure/database/dispatch-key", () => ({
  reserveDispatchKey: vi.fn(async (key: string) => {
    if (mocks.keys.has(key)) return false;
    mocks.keys.add(key);
    return true;
  }),
  releaseDispatchKey: vi.fn(async (key: string) => void mocks.keys.delete(key)),
}));
vi.mock("@/infrastructure/email/email-availability", () => ({ canSendEmailForTenant: mocks.canSend }));
vi.mock("@/infrastructure/queue/redis-connection", () => ({
  isQueueConsumerAvailable: mocks.queueAvailable,
  tripRedisCircuit: mocks.tripCircuit,
}));
vi.mock("@/infrastructure/queue/email-dispatch-queue", () => ({ getEmailDispatchQueue: mocks.getQueue }));
vi.mock("@/infrastructure/email/email-dispatch-processor", () => ({ processEmailDispatchJob: mocks.process }));
vi.mock("@/lib/observability/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { enqueueEmailDispatch } = await import("./email-dispatch-emitter");
const { EmailDispatchRetryableError } = await import("./email-send-error");

const checklistComplete = (targetUserIds = ["u1"]): EmailDispatchJobPayload => ({
  kind: "checklist_complete_staff",
  tenantId: "t1",
  data: {
    patientName: "Maria",
    stageName: "Pré-operatório",
    totalRequiredItems: 3,
    clientId: "c1",
    targetUserIds,
    clinicName: "Clínica",
  },
});

describe("enqueueEmailDispatch", () => {
  beforeEach(() => {
    mocks.keys.clear();
    mocks.canSend.mockReset().mockResolvedValue(true);
    mocks.queueAvailable.mockReset().mockReturnValue(false);
    mocks.tripCircuit.mockReset();
    mocks.queueAdd.mockReset().mockResolvedValue(undefined);
    mocks.getQueue.mockReset().mockReturnValue({ add: mocks.queueAdd });
    mocks.process.mockReset().mockResolvedValue(undefined);
  });

  describe("inline mode (no queue consumer)", () => {
    it("should dispatch a deterministic jobId only once", async () => {
      await enqueueEmailDispatch(checklistComplete(), { jobId: "email|cl|t1|pp1|st1" });
      await enqueueEmailDispatch(checklistComplete(), { jobId: "email|cl|t1|pp1|st1" });

      expect(mocks.process).toHaveBeenCalledTimes(1);
    });

    it("should dispatch different jobIds independently (re-entering a stage uses a new transition id)", async () => {
      await enqueueEmailDispatch(checklistComplete(), { jobId: "email|st|t1|pp1|st1|transition-1" });
      await enqueueEmailDispatch(checklistComplete(), { jobId: "email|st|t1|pp1|st1|transition-2" });

      expect(mocks.process).toHaveBeenCalledTimes(2);
    });

    it("should not dedupe when the caller gives no jobId", async () => {
      await enqueueEmailDispatch(checklistComplete());
      await enqueueEmailDispatch(checklistComplete());

      expect(mocks.process).toHaveBeenCalledTimes(2);
      expect(mocks.keys.size).toBe(0);
    });

    it("should release the reservation and only log when delivery fails transiently, so a rerun can retry", async () => {
      mocks.process.mockRejectedValueOnce(new EmailDispatchRetryableError("checklist_complete_staff", 1));

      await expect(enqueueEmailDispatch(checklistComplete(), { jobId: "job-1" })).resolves.toBeUndefined();
      expect(mocks.keys.has("email-job|job-1")).toBe(false);

      await enqueueEmailDispatch(checklistComplete(), { jobId: "job-1" });
      expect(mocks.process).toHaveBeenCalledTimes(2);
    });

    it("should release the reservation and propagate unexpected errors", async () => {
      mocks.process.mockRejectedValueOnce(new Error("db down"));

      await expect(enqueueEmailDispatch(checklistComplete(), { jobId: "job-2" })).rejects.toThrow("db down");
      expect(mocks.keys.has("email-job|job-2")).toBe(false);
    });
  });

  describe("queue mode", () => {
    beforeEach(() => mocks.queueAvailable.mockReturnValue(true));

    it("should enqueue with the caller's jobId and leave dedupe to the queue", async () => {
      await enqueueEmailDispatch(checklistComplete(), { jobId: "job-3" });

      expect(mocks.queueAdd).toHaveBeenCalledWith("send", expect.objectContaining({ kind: "checklist_complete_staff" }), {
        jobId: "job-3",
      });
      expect(mocks.process).not.toHaveBeenCalled();
      expect(mocks.keys.size).toBe(0);
    });

    it("should not force a shared default jobId that would silently drop later emails", async () => {
      await enqueueEmailDispatch(checklistComplete());

      expect(mocks.queueAdd).toHaveBeenCalledWith("send", expect.anything(), undefined);
    });

    it("should fall back to deduplicated inline delivery when the queue fails", async () => {
      mocks.queueAdd.mockRejectedValue(new Error("redis down"));

      await enqueueEmailDispatch(checklistComplete(), { jobId: "job-4" });
      await enqueueEmailDispatch(checklistComplete(), { jobId: "job-4" });

      expect(mocks.tripCircuit).toHaveBeenCalled();
      expect(mocks.process).toHaveBeenCalledTimes(1);
    });
  });

  it("should skip jobs without recipients or when the tenant cannot send", async () => {
    await enqueueEmailDispatch(checklistComplete([]), { jobId: "job-5" });
    mocks.canSend.mockResolvedValue(false);
    await enqueueEmailDispatch(checklistComplete(), { jobId: "job-6" });

    expect(mocks.process).not.toHaveBeenCalled();
    expect(mocks.queueAdd).not.toHaveBeenCalled();
  });
});

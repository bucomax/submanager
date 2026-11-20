import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findActiveUserForPasswordReset: vi.fn(),
  createPasswordResetToken: vi.fn(),
  isEmailConfigured: vi.fn(),
  sendEmail: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/infrastructure/repositories/user.repository", () => ({
  userPrismaRepository: {
    findActiveUserForPasswordReset: mocks.findActiveUserForPasswordReset,
    createPasswordResetToken: mocks.createPasswordResetToken,
  },
}));
vi.mock("@/infrastructure/email/resend.client", () => ({
  isEmailConfigured: mocks.isEmailConfigured,
  sendEmail: mocks.sendEmail,
  buildResetPasswordUrl: (token: string) => `https://app.example/reset?token=${token}`,
}));
vi.mock("@/infrastructure/email/email-templates", () => ({ getResetPasswordHtml: () => "<p>reset</p>" }));
vi.mock("@/lib/observability/logger", () => ({
  logger: { error: mocks.logError, warn: vi.fn(), info: vi.fn() },
}));

const { runForgotPassword } = await import("./forgot-password");

const USER = { id: "user-1", email: "ana@clinic.example", name: "Ana", passwordHash: "$2a$12$hash" };

/** Parte observável pelo cliente HTTP (a rota só usa `ok`/`messageKey`; `afterResponse` roda depois da resposta). */
function publicShape(result: Awaited<ReturnType<typeof runForgotPassword>>) {
  return result.ok ? { ok: result.ok, messageKey: result.messageKey } : result;
}

async function runDeferred(result: Awaited<ReturnType<typeof runForgotPassword>>): Promise<void> {
  if (!result.ok) throw new Error("expected an ok result");
  await result.afterResponse();
}

describe("runForgotPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isEmailConfigured.mockReturnValue(true);
    mocks.createPasswordResetToken.mockResolvedValue(undefined);
    mocks.sendEmail.mockResolvedValue({ error: null });
  });

  it("should answer the same for an unknown email, an existing one and an existing one whose send fails", async () => {
    mocks.findActiveUserForPasswordReset.mockResolvedValueOnce(null);
    const unknown = await runForgotPassword("ghost@clinic.example");

    mocks.findActiveUserForPasswordReset.mockResolvedValueOnce(USER);
    const existing = await runForgotPassword(USER.email);

    mocks.sendEmail.mockResolvedValueOnce({ error: { message: "provider down" } });
    mocks.findActiveUserForPasswordReset.mockResolvedValueOnce(USER);
    const sendFails = await runForgotPassword(USER.email);
    await runDeferred(sendFails);

    expect(publicShape(unknown)).toEqual({ ok: true, messageKey: "success.forgotPasswordHint" });
    expect(publicShape(existing)).toEqual(publicShape(unknown));
    expect(publicShape(sendFails)).toEqual(publicShape(unknown));
  });

  it("should not create tokens nor send anything before the response (work is deferred)", async () => {
    mocks.findActiveUserForPasswordReset.mockResolvedValue(USER);

    await runForgotPassword(USER.email);

    expect(mocks.createPasswordResetToken).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("should issue the token and send the email in afterResponse for an existing user with password", async () => {
    mocks.findActiveUserForPasswordReset.mockResolvedValue(USER);

    const result = await runForgotPassword("  ANA@Clinic.example ");
    await runDeferred(result);

    expect(mocks.findActiveUserForPasswordReset).toHaveBeenCalledWith("ana@clinic.example");
    expect(mocks.createPasswordResetToken).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1" }));
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: USER.email }));
  });

  it("should only log (with ids, no email) when the provider reports an error", async () => {
    mocks.findActiveUserForPasswordReset.mockResolvedValue(USER);
    mocks.sendEmail.mockResolvedValue({ error: { message: "provider down" } });

    const result = await runForgotPassword(USER.email);
    await expect(runDeferred(result)).resolves.toBeUndefined();

    expect(mocks.logError).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(mocks.logError.mock.calls[0]);
    expect(logged).toContain("user-1");
    expect(logged).not.toContain(USER.email);
  });

  it("should swallow and log a thrown send/persist failure so the deferred task never rejects", async () => {
    mocks.findActiveUserForPasswordReset.mockResolvedValue(USER);
    mocks.sendEmail.mockRejectedValue(new Error("network"));

    const result = await runForgotPassword(USER.email);

    await expect(runDeferred(result)).resolves.toBeUndefined();
    expect(mocks.logError).toHaveBeenCalledTimes(1);
  });

  it("should do nothing in afterResponse when the user is unknown or has no password", async () => {
    mocks.findActiveUserForPasswordReset.mockResolvedValueOnce(null);
    const unknown = await runForgotPassword("ghost@clinic.example");
    mocks.findActiveUserForPasswordReset.mockResolvedValueOnce({ ...USER, passwordHash: null });
    const noPassword = await runForgotPassword(USER.email);

    await runDeferred(unknown);
    await runDeferred(noPassword);

    expect(mocks.createPasswordResetToken).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("should report EMAIL_NOT_CONFIGURED (platform-level, not per user) before looking anyone up", async () => {
    mocks.isEmailConfigured.mockReturnValue(false);

    expect(await runForgotPassword(USER.email)).toEqual({ ok: false, code: "EMAIL_NOT_CONFIGURED" });
    expect(mocks.findActiveUserForPasswordReset).not.toHaveBeenCalled();
  });
});

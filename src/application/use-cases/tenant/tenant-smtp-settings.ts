import { decryptTenantSecret, encryptTenantSecret } from "@/infrastructure/crypto/tenant-secret";
import { sendEmailViaSmtp } from "@/infrastructure/email/smtp-send.client";
import { tenantPrismaRepository } from "@/infrastructure/repositories/tenant.repository";
import type { PatchTenantSmtpBody } from "@/lib/validators/tenant-smtp";
import type { TenantSmtpDto } from "@/types/api/tenant-smtp-v1";

function toDto(row: {
  smtpEnabled: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPasswordEnc: string | null;
  smtpFromName: string | null;
  smtpFromAddress: string | null;
}): TenantSmtpDto {
  return {
    smtpEnabled: row.smtpEnabled,
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpSecure: row.smtpSecure,
    smtpUser: row.smtpUser,
    hasPassword: Boolean(row.smtpPasswordEnc),
    smtpFromName: row.smtpFromName,
    smtpFromAddress: row.smtpFromAddress,
  };
}

export async function getTenantSmtpState(
  tenantId: string,
): Promise<{ smtp: TenantSmtpDto } | null> {
  const row = await tenantPrismaRepository.findTenantSmtpForSettings(tenantId);
  if (!row) return null;
  return { smtp: toDto(row) };
}

export type PatchSmtpResult =
  | { ok: true; dto: TenantSmtpDto }
  | { ok: false; code: "TENANT_NOT_FOUND" | "ENCRYPTION_KEY" | "VALIDATION" }
  | { ok: false; code: "INVALID_SMTP_WHEN_ENABLING"; message: string };

function isSmtpStructurallyComplete(
  r: {
    smtpHost?: string | null;
    smtpUser?: string | null;
    smtpPasswordEnc?: string | null;
    smtpFromAddress?: string | null;
    smtpFromName?: string | null;
  } | null,
): boolean {
  if (!r) return false;
  return Boolean(
    r.smtpHost?.trim() &&
      r.smtpUser?.trim() &&
      r.smtpPasswordEnc &&
      r.smtpFromAddress?.trim() &&
      r.smtpFromName?.trim(),
  );
}

export async function patchTenantSmtp(
  tenantId: string,
  body: PatchTenantSmtpBody,
): Promise<PatchSmtpResult> {
  const existing = await tenantPrismaRepository.findTenantSmtpForSettings(tenantId);
  if (!existing) {
    return { ok: false, code: "TENANT_NOT_FOUND" };
  }

  let newPasswordEnc: string | null | undefined;
  if (body.smtpPassword !== undefined) {
    const raw = body.smtpPassword;
    if (raw != null && raw.length > 0) {
      try {
        newPasswordEnc = encryptTenantSecret(raw);
      } catch {
        return { ok: false, code: "ENCRYPTION_KEY" };
      }
    }
  }

  const nextHost = body.smtpHost !== undefined ? (body.smtpHost === "" ? null : body.smtpHost.trim()) : existing.smtpHost;
  const nextPort = body.smtpPort !== undefined ? body.smtpPort : existing.smtpPort;
  const nextSecure = body.smtpSecure !== undefined ? body.smtpSecure : existing.smtpSecure;
  const nextUser = body.smtpUser !== undefined ? (body.smtpUser === "" ? null : body.smtpUser.trim()) : existing.smtpUser;
  const nextFromName =
    body.smtpFromName !== undefined
      ? body.smtpFromName === ""
        ? null
        : body.smtpFromName.trim()
      : existing.smtpFromName;
  const nextFromAddress =
    body.smtpFromAddress !== undefined
      ? body.smtpFromAddress === ""
        ? null
        : String(body.smtpFromAddress).trim()
      : existing.smtpFromAddress;
  const nextPasswordEnc =
    newPasswordEnc !== undefined ? newPasswordEnc : existing.smtpPasswordEnc;
  const nextEnabled = body.smtpEnabled !== undefined ? body.smtpEnabled : existing.smtpEnabled;

  const virtual = {
    smtpEnabled: nextEnabled,
    smtpHost: nextHost,
    smtpPort: nextPort,
    smtpSecure: nextSecure,
    smtpUser: nextUser,
    smtpPasswordEnc: nextPasswordEnc,
    smtpFromName: nextFromName,
    smtpFromAddress: nextFromAddress,
  };
  if (nextEnabled && !isSmtpStructurallyComplete(virtual)) {
    return {
      ok: false,
      code: "INVALID_SMTP_WHEN_ENABLING",
      message: "Preencha host, usuário, senha, nome e e-mail do remetente para ativar o SMTP.",
    };
  }

  const patch: Parameters<typeof tenantPrismaRepository.patchTenantSmtpSettings>[1] = {};
  if (body.smtpEnabled !== undefined) {
    patch.smtpEnabled = body.smtpEnabled;
    patch.emailOutboundMode = body.smtpEnabled ? "smtp" : "platform";
  }
  if (body.smtpHost !== undefined) patch.smtpHost = body.smtpHost === "" ? null : body.smtpHost.trim();
  if (body.smtpPort !== undefined) patch.smtpPort = body.smtpPort;
  if (body.smtpSecure !== undefined) patch.smtpSecure = body.smtpSecure;
  if (body.smtpUser !== undefined) patch.smtpUser = body.smtpUser === "" ? null : body.smtpUser.trim();
  if (body.smtpFromName !== undefined) {
    patch.smtpFromName = body.smtpFromName === "" ? null : body.smtpFromName.trim();
  }
  if (body.smtpFromAddress !== undefined) {
    patch.smtpFromAddress = body.smtpFromAddress === "" ? null : String(body.smtpFromAddress).trim();
  }
  if (newPasswordEnc !== undefined) {
    patch.smtpPasswordEnc = newPasswordEnc;
  }

  const after = await tenantPrismaRepository.patchTenantSmtpSettings(tenantId, patch);
  return { ok: true, dto: toDto(after) };
}

export type TestSmtpResult =
  | { ok: true; message: string }
  | { ok: false; code: "TENANT_NOT_FOUND" | "INCOMPLETE" | "SEND_FAILED"; message: string };

export async function testTenantSmtp(
  tenantId: string,
  toAddress: string,
): Promise<TestSmtpResult> {
  const r = await tenantPrismaRepository.findTenantSmtpForSettings(tenantId);
  if (!r) {
    return { ok: false, code: "TENANT_NOT_FOUND", message: "Clínica não encontrada." };
  }
  if (!isSmtpStructurallyComplete(r)) {
    return {
      ok: false,
      code: "INCOMPLETE",
      message: "Salve a configuração completa (host, usuário, senha, remetente) antes de testar.",
    };
  }
  let pass: string;
  try {
    pass = decryptTenantSecret(r.smtpPasswordEnc!);
  } catch {
    return { ok: false, code: "SEND_FAILED", message: "Falha ao ler a senha armazenada." };
  }
  const port = r.smtpPort ?? 587;
  const name = (r.smtpFromName ?? "Notificações").replace(/[<>]/g, "");
  const fromAddr = r.smtpFromAddress!.trim();
  const from = `${name} <${fromAddr}>`;
  const res = await sendEmailViaSmtp(
    {
      host: r.smtpHost!.trim(),
      port,
      secure: r.smtpSecure,
      user: r.smtpUser!.trim(),
      pass,
    },
    {
      from,
      to: toAddress,
      subject: "SubManager — e-mail de teste",
      html: "<p>Se você recebeu esta mensagem, a configuração SMTP está correta.</p>",
      text: "Se você recebeu esta mensagem, a configuração SMTP está correta.",
    },
  );
  if (res.error) {
    return { ok: false, code: "SEND_FAILED", message: res.error.message };
  }
  return { ok: true, message: "E-mail de teste enviado." };
}

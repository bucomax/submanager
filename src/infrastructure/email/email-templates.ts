/**
 * Templates HTML transacionais (Resend).
 * Layout em tabela, preheader, CTA, footer — marca **SubManager**; tema **escuro** (fundo preto, texto claro).
 */

import { getPublicAppUrl } from "@/lib/config/urls";

/** Tema escuro único para todos os e-mails transacionais (fundo preto, texto claro). */
const BRAND = {
  pageBg: "#000000",
  cardBg: "#000000",
  headerBg: "#000000",
  primary: "#fafafa",
  ctaBg: "#fafafa",
  ctaText: "#000000",
  background: "#000000",
  text: "#fafafa",
  textMuted: "#a1a1aa",
  border: "#3f3f46",
  link: "#e4e4e7",
} as const;

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type BaseLayoutOptions = { preheader?: string; brandName?: string };

function baseLayout(content: string, preheaderOrOptions?: string | BaseLayoutOptions): string {
  const options: BaseLayoutOptions =
    preheaderOrOptions === undefined
      ? {}
      : typeof preheaderOrOptions === "string"
        ? { preheader: preheaderOrOptions }
        : preheaderOrOptions;
  const preheader = options.preheader;
  const brandLabel = escapeHtmlText(options.brandName?.trim() || "SubManager");
  const base = getPublicAppUrl();
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <title>${brandLabel}</title>
  ${preheader ? `<style type="text/css">#preheader { display: none !important; }</style>` : ""}
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.pageBg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  ${preheader ? `<span id="preheader">${preheader}</span>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.pageBg};">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: ${BRAND.cardBg}; border-radius: 12px; overflow: hidden; border: 1px solid ${BRAND.border};">
          <tr>
            <td style="background-color: ${BRAND.headerBg}; padding: 24px 32px; text-align: center; border-bottom: 1px solid ${BRAND.border};">
              <a href="${base}" style="text-decoration: none; color: ${BRAND.primary}; font-size: 22px; font-weight: 700;">${brandLabel}</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 32px 40px; background-color: ${BRAND.background};">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; background-color: ${BRAND.cardBg}; border-top: 1px solid ${BRAND.border};">
              <p style="margin: 0; font-size: 12px; color: ${BRAND.textMuted}; text-align: center;">
                ${brandLabel} — plataforma clínica multi-tenant
              </p>
              <p style="margin: 8px 0 0; font-size: 12px; color: ${BRAND.textMuted}; text-align: center;">
                <a href="${base}" style="color: ${BRAND.link}; text-decoration: underline;">Abrir aplicação</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

function ctaButton(href: string, label: string): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
  <tr>
    <td align="center">
      <a href="${href}" style="display: inline-block; padding: 14px 28px; background-color: ${BRAND.ctaBg}; color: ${BRAND.ctaText}; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
        ${label}
      </a>
    </td>
  </tr>
</table>
`.trim();
}

/** Confirmação de e-mail (cadastro público, se existir). */
export function getConfirmEmailHtml(params: { name: string | null; confirmUrl: string }): string {
  const name = params.name || "Usuário";
  const content = `
    <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: ${BRAND.text}; line-height: 1.3;">
      Confirme seu e-mail
    </h1>
    <p style="margin: 0 0 16px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      Olá, ${name}!
    </p>
    <p style="margin: 0 0 8px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      Clique no botão abaixo para confirmar seu endereço de e-mail e ativar sua conta.
    </p>
    ${ctaButton(params.confirmUrl, "Confirmar e-mail")}
    <p style="margin: 16px 0 0; font-size: 13px; color: ${BRAND.textMuted}; line-height: 1.5;">
      Ou copie e cole no navegador:
    </p>
    <p style="margin: 4px 0 0; font-size: 12px; color: ${BRAND.textMuted}; word-break: break-all;">
      <a href="${params.confirmUrl}" style="color: ${BRAND.link}; text-decoration: underline;">${params.confirmUrl}</a>
    </p>
    <p style="margin: 24px 0 0; padding-top: 20px; border-top: 1px solid ${BRAND.border}; font-size: 12px; color: ${BRAND.textMuted};">
      Este link expira em 24 horas. Se você não criou esta conta, ignore este e-mail.
    </p>
  `;
  return baseLayout(content, `Confirme seu e-mail — SubManager`);
}

/** Recuperação de senha. */
export function getResetPasswordHtml(params: { name: string | null; resetUrl: string }): string {
  const name = params.name || "Usuário";
  const content = `
    <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: ${BRAND.text}; line-height: 1.3;">
      Recuperação de senha
    </h1>
    <p style="margin: 0 0 16px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      Olá, ${name}!
    </p>
    <p style="margin: 0 0 8px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      Recebemos um pedido para redefinir sua senha. Clique no botão abaixo para criar uma nova senha.
    </p>
    ${ctaButton(params.resetUrl, "Redefinir senha")}
    <p style="margin: 16px 0 0; font-size: 13px; color: ${BRAND.textMuted}; line-height: 1.5;">
      Ou copie e cole no navegador:
    </p>
    <p style="margin: 4px 0 0; font-size: 12px; color: ${BRAND.textMuted}; word-break: break-all;">
      <a href="${params.resetUrl}" style="color: ${BRAND.link}; text-decoration: underline;">${params.resetUrl}</a>
    </p>
    <p style="margin: 24px 0 0; padding-top: 20px; border-top: 1px solid ${BRAND.border}; font-size: 12px; color: ${BRAND.textMuted};">
      Este link expira em 1 hora. Se você não solicitou isso, ignore este e-mail.
    </p>
  `;
  return baseLayout(content, `Redefina sua senha — SubManager`);
}

/**
 * Convite: administrador criou a conta — usuário define a senha no primeiro acesso.
 */
export function getInviteSetPasswordHtml(params: {
  name: string | null;
  setPasswordUrl: string;
  tenantName: string;
  tenantTaxIdDisplay: string | null;
}): string {
  const name = escapeHtmlText(params.name || "Usuário");
  const tenantName = escapeHtmlText(params.tenantName);
  const taxBlock = params.tenantTaxIdDisplay
    ? `<p style="margin: 0 0 4px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
        <span style="font-weight: 600;">CNPJ:</span> ${escapeHtmlText(params.tenantTaxIdDisplay)}
      </p>`
    : "";
  const content = `
    <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: ${BRAND.text}; line-height: 1.3;">
      Você foi convidado para o SubManager
    </h1>
    <p style="margin: 0 0 16px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      Olá, ${name}!
    </p>
    <p style="margin: 0 0 4px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      <span style="font-weight: 600;">Clínica:</span> ${tenantName}
    </p>
    ${taxBlock}
    <p style="margin: 16px 0 8px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      Uma conta foi criada para você neste espaço de trabalho. Clique no botão abaixo para definir sua senha e começar.
    </p>
    ${ctaButton(params.setPasswordUrl, "Definir senha")}
    <p style="margin: 16px 0 0; font-size: 13px; color: ${BRAND.textMuted}; line-height: 1.5;">
      Ou copie e cole no navegador:
    </p>
    <p style="margin: 4px 0 0; font-size: 12px; color: ${BRAND.textMuted}; word-break: break-all;">
      <a href="${params.setPasswordUrl}" style="color: ${BRAND.link}; text-decoration: underline;">${params.setPasswordUrl}</a>
    </p>
    <p style="margin: 24px 0 0; padding-top: 20px; border-top: 1px solid ${BRAND.border}; font-size: 12px; color: ${BRAND.textMuted};">
      Este link expira em 48 horas. Se você não esperava este convite, ignore este e-mail.
    </p>
  `;
  return baseLayout(content, {
    preheader: "Defina sua senha — convite SubManager",
    brandName: params.tenantName,
  });
}

/**
 * Paciente: cadastro público concluído — confirmação + boas-vindas (mesmo layout escuro SubManager).
 */
export function getPatientSelfRegisterWelcomeHtml(params: {
  patientName: string;
  clinicName: string;
  portalLoginUrl: string;
}): string {
  const first = params.patientName.trim().split(/\s+/)[0] || params.patientName.trim();
  const greeting = escapeHtmlText(first);
  const clinic = escapeHtmlText(params.clinicName);
  const content = `
    <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: ${BRAND.text}; line-height: 1.3;">
      Tudo certo — cadastro recebido
    </h1>
    <p style="margin: 0 0 16px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      Olá, ${greeting}!
    </p>
    <p style="margin: 0 0 8px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      Recebemos seus dados com sucesso. A equipe da <strong>${clinic}</strong> já pode acompanhar seu cadastro por aqui — seja bem-vindo(a) à jornada com a gente.
    </p>
    <p style="margin: 0 0 16px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      Em breve alguém da clínica entra em contato pelo <strong>telefone</strong> ou <strong>WhatsApp</strong> que você informou para alinhar os próximos passos do seu tratamento.
    </p>
    <p style="margin: 0 0 16px; font-size: 15px; color: ${BRAND.textMuted}; line-height: 1.6;">
      Quando quiser, você pode acessar o <strong style="color: ${BRAND.text};">portal do paciente</strong> com o e-mail ou CPF e a senha que você criou:
    </p>
    ${ctaButton(params.portalLoginUrl, "Abrir portal do paciente")}
    <p style="margin: 16px 0 0; font-size: 13px; color: ${BRAND.textMuted}; line-height: 1.5;">
      Ou copie o link:
    </p>
    <p style="margin: 4px 0 0; font-size: 12px; color: ${BRAND.textMuted}; word-break: break-all;">
      <a href="${params.portalLoginUrl}" style="color: ${BRAND.link}; text-decoration: underline;">${params.portalLoginUrl}</a>
    </p>
    <p style="margin: 24px 0 0; padding-top: 20px; border-top: 1px solid ${BRAND.border}; font-size: 12px; color: ${BRAND.textMuted}; line-height: 1.5;">
      Se você não realizou este cadastro, ignore este e-mail ou entre em contato com a clínica.
    </p>
  `;
  return baseLayout(content, {
    preheader: `Cadastro recebido — ${escapeHtmlText(params.clinicName)}`,
    brandName: params.clinicName,
  });
}

/** Equipe da clínica: paciente concluiu auto-cadastro pelo link/QR (mesmo padrão visual dos demais e-mails transacionais). */
export function getPatientSelfRegisteredStaffHtml(params: {
  staffName: string | null;
  patientName: string;
  clinicName: string;
  openPatientUrl: string;
}): string {
  const whoRaw = params.staffName?.trim() || "Olá";
  const who = escapeHtmlText(whoRaw);
  const patient = escapeHtmlText(params.patientName);
  const clinic = escapeHtmlText(params.clinicName);
  const content = `
    <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: ${BRAND.text}; line-height: 1.3;">
      Novo paciente — cadastro pelo paciente
    </h1>
    <p style="margin: 0 0 16px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      ${who},
    </p>
    <p style="margin: 0 0 8px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      <strong>${patient}</strong> concluiu o formulário em <strong>${clinic}</strong>.
    </p>
    <p style="margin: 0 0 16px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      Acesse o painel para escolher o tipo de tratamento / jornada deste paciente.
    </p>
    ${ctaButton(params.openPatientUrl, "Abrir ficha do paciente")}
    <p style="margin: 16px 0 0; font-size: 13px; color: ${BRAND.textMuted}; line-height: 1.5;">
      Ou copie o link:
    </p>
    <p style="margin: 4px 0 0; font-size: 12px; color: ${BRAND.textMuted}; word-break: break-all;">
      <a href="${params.openPatientUrl}" style="color: ${BRAND.link}; text-decoration: underline;">${params.openPatientUrl}</a>
    </p>
    <p style="margin: 24px 0 0; padding-top: 20px; border-top: 1px solid ${BRAND.border}; font-size: 12px; color: ${BRAND.textMuted}; line-height: 1.5;">
      Este aviso foi enviado porque você é membro da equipe desta clínica no SubManager. Se não deveria recebê-lo, ignore esta mensagem.
    </p>
  `;
  return baseLayout(content, {
    preheader: `Novo paciente em ${escapeHtmlText(params.clinicName)} — SubManager`,
    brandName: params.clinicName,
  });
}

/** Paciente: acesso ao portal da jornada (magic link). */
export function getPatientPortalMagicLinkHtml(params: {
  patientName: string;
  clinicName: string;
  enterUrl: string;
  /** Se true, o texto alerta uso único do link (envio por e-mail). */
  singleUse: boolean;
}): string {
  const patient = escapeHtmlText(params.patientName);
  const clinic = escapeHtmlText(params.clinicName);
  const reuseNote = params.singleUse
    ? "Este link expira em 72 horas e só pode ser usado uma vez."
    : "Este link expira em 72 horas e pode ser aberto várias vezes até lá (guarde-o em local seguro).";
  const content = `
    <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: ${BRAND.text}; line-height: 1.3;">
      Acesse seu acompanhamento
    </h1>
    <p style="margin: 0 0 16px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      Olá, ${patient}!
    </p>
    <p style="margin: 0 0 8px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      A clínica <strong>${clinic}</strong> disponibilizou um link seguro para você acompanhar sua jornada no SubManager.
    </p>
    ${ctaButton(params.enterUrl, "Abrir portal do paciente")}
    <p style="margin: 16px 0 0; font-size: 13px; color: ${BRAND.textMuted}; line-height: 1.5;">
      Ou copie e cole no navegador:
    </p>
    <p style="margin: 4px 0 0; font-size: 12px; color: ${BRAND.textMuted}; word-break: break-all;">
      <a href="${params.enterUrl}" style="color: ${BRAND.link}; text-decoration: underline;">${params.enterUrl}</a>
    </p>
    <p style="margin: 24px 0 0; padding-top: 20px; border-top: 1px solid ${BRAND.border}; font-size: 12px; color: ${BRAND.textMuted};">
      ${reuseNote} Se você não solicitou este acesso, ignore este e-mail.
    </p>
  `;
  return baseLayout(content, {
    preheader: `Acesso ao portal — ${escapeHtmlText(params.clinicName)}`,
    brandName: params.clinicName,
  });
}

/** Paciente: código para entrar no portal com CPF (OTP). */
export function getPatientPortalOtpHtml(params: {
  patientName: string;
  clinicName: string;
  code: string;
}): string {
  const patient = escapeHtmlText(params.patientName);
  const clinic = escapeHtmlText(params.clinicName);
  const code = escapeHtmlText(params.code);
  const content = `
    <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: ${BRAND.text}; line-height: 1.3;">
      Seu código de acesso
    </h1>
    <p style="margin: 0 0 16px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      Olá, ${patient}!
    </p>
    <p style="margin: 0 0 16px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      Use o código abaixo para entrar no portal da clínica <strong>${clinic}</strong>. Ele vale por poucos minutos.
    </p>
    <p style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 0.2em; color: ${BRAND.primary}; text-align: center;">
      ${code}
    </p>
    <p style="margin: 24px 0 0; padding-top: 20px; border-top: 1px solid ${BRAND.border}; font-size: 12px; color: ${BRAND.textMuted};">
      Se você não pediu este código, ignore este e-mail.
    </p>
  `;
  return baseLayout(content, {
    preheader: `Código do portal — ${escapeHtmlText(params.clinicName)}`,
    brandName: params.clinicName,
  });
}

/** Paciente: resultado da revisao de arquivo enviado pelo portal (aprovado ou rejeitado). */
export function getFileReviewResultPatientHtml(params: {
  patientName: string;
  clinicName: string;
  fileName: string;
  decision: "approve" | "reject";
  rejectReason?: string;
  portalUrl: string;
}): string {
  const first = params.patientName.trim().split(/\s+/)[0] || params.patientName.trim();
  const greeting = escapeHtmlText(first);
  const clinic = escapeHtmlText(params.clinicName);
  const file = escapeHtmlText(params.fileName);

  const isApproved = params.decision === "approve";
  const title = isApproved
    ? "Documento aprovado"
    : "Documento precisa de ajustes";
  const preheader = isApproved
    ? `Documento aprovado — ${clinic}`
    : `Documento precisa de ajustes — ${clinic}`;

  const statusBlock = isApproved
    ? `<p style="margin: 0 0 16px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
        Seu documento <strong>${file}</strong> foi <strong style="color: #22c55e;">aprovado</strong> pela equipe da <strong>${clinic}</strong>.
      </p>`
    : `<p style="margin: 0 0 8px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
        Seu documento <strong>${file}</strong> foi <strong style="color: #ef4444;">devolvido para ajustes</strong> pela equipe da <strong>${clinic}</strong>.
      </p>
      ${
        params.rejectReason?.trim()
          ? `<p style="margin: 0 0 16px; font-size: 14px; color: ${BRAND.textMuted}; line-height: 1.6; padding: 12px 16px; background-color: #18181b; border-radius: 8px; border: 1px solid ${BRAND.border};">
              <strong style="color: ${BRAND.text};">Motivo:</strong> ${escapeHtmlText(params.rejectReason.trim())}
            </p>`
          : ""
      }`;

  const ctaLabel = isApproved ? "Abrir portal do paciente" : "Enviar documento corrigido";

  const content = `
    <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: ${BRAND.text}; line-height: 1.3;">
      ${title}
    </h1>
    <p style="margin: 0 0 16px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      Olá, ${greeting}!
    </p>
    ${statusBlock}
    ${ctaButton(params.portalUrl, ctaLabel)}
    <p style="margin: 16px 0 0; font-size: 13px; color: ${BRAND.textMuted}; line-height: 1.5;">
      Ou copie o link:
    </p>
    <p style="margin: 4px 0 0; font-size: 12px; color: ${BRAND.textMuted}; word-break: break-all;">
      <a href="${params.portalUrl}" style="color: ${BRAND.link}; text-decoration: underline;">${params.portalUrl}</a>
    </p>
    <p style="margin: 24px 0 0; padding-top: 20px; border-top: 1px solid ${BRAND.border}; font-size: 12px; color: ${BRAND.textMuted}; line-height: 1.5;">
      Este e-mail foi enviado porque voce enviou um documento pelo portal da clinica no SubManager. Se nao reconhece esta acao, ignore esta mensagem.
    </p>
  `;
  return baseLayout(content, { preheader, brandName: params.clinicName });
}

/** Paciente: nova etapa na jornada (transição). */
export function getStageTransitionPatientHtml(params: {
  patientName: string;
  clinicName: string;
  stageName: string;
  patientMessage: string | null;
  documents: { fileName: string }[];
  portalUrl: string;
}): string {
  const greeting =
    escapeHtmlText(params.patientName.trim().split(/\s+/)[0] || params.patientName.trim());
  const clinic = escapeHtmlText(params.clinicName);
  const stage = escapeHtmlText(params.stageName);
  const msg =
    params.patientMessage?.trim() ?
      `<p style="margin: 0 0 16px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
        ${escapeHtmlText(params.patientMessage.trim())}
      </p>`
    : "";
  const docBlock =
    params.documents.length > 0 ?
      `<p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: ${BRAND.text};">
        Documentos desta etapa:
      </p>
      <ul style="margin: 0 0 16px; padding-left: 20px; color: ${BRAND.textMuted}; font-size: 14px; line-height: 1.6;">
        ${params.documents.map((d) => `<li>${escapeHtmlText(d.fileName)}</li>`).join("")}
      </ul>`
    : "";
  const content = `
    <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: ${BRAND.text}; line-height: 1.3;">
      Você avançou na jornada
    </h1>
    <p style="margin: 0 0 16px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      Olá, ${greeting}!
    </p>
    <p style="margin: 0 0 8px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      A equipe da <strong>${clinic}</strong> registrou sua entrada na etapa <strong>${stage}</strong>.
    </p>
    ${msg}
    ${docBlock}
    ${ctaButton(params.portalUrl, "Abrir portal do paciente")}
    <p style="margin: 16px 0 0; font-size: 13px; color: ${BRAND.textMuted}; line-height: 1.5;">
      Ou copie o link:
    </p>
    <p style="margin: 4px 0 0; font-size: 12px; color: ${BRAND.textMuted}; word-break: break-all;">
      <a href="${params.portalUrl}" style="color: ${BRAND.link}; text-decoration: underline;">${params.portalUrl}</a>
    </p>
    <p style="margin: 24px 0 0; padding-top: 20px; border-top: 1px solid ${BRAND.border}; font-size: 12px; color: ${BRAND.textMuted}; line-height: 1.5;">
      Este e-mail foi enviado porque sua jornada na clínica foi atualizada no SubManager.
    </p>
  `;
  return baseLayout(content, {
    preheader: `Nova etapa: ${stage} — ${clinic}`,
    brandName: params.clinicName,
  });
}

/** Staff: alerta de SLA (atenção ou crítico). */
export function getSlaAlertStaffHtml(params: {
  staffName: string | null;
  patientName: string;
  stageName: string;
  daysInStage: number;
  slaThresholdDays: number;
  clinicName: string;
  severity: "warning" | "danger";
  patientUrl: string;
}): string {
  const who = escapeHtmlText(params.staffName?.trim() || "Olá");
  const patient = escapeHtmlText(params.patientName);
  const stage = escapeHtmlText(params.stageName);
  const clinic = escapeHtmlText(params.clinicName);
  const isDanger = params.severity === "danger";
  const badgeColor = isDanger ? "#ef4444" : "#f59e0b";
  const badgeLabel = isDanger ? "Alerta crítico" : "Atenção";
  const content = `
    <p style="margin: 0 0 12px;">
      <span style="display: inline-block; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; color: #000; background-color: ${badgeColor};">
        ${badgeLabel}
      </span>
    </p>
    <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: ${BRAND.text}; line-height: 1.3;">
      SLA da etapa
    </h1>
    <p style="margin: 0 0 16px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      ${who},
    </p>
    <p style="margin: 0 0 8px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      <strong>${patient}</strong> está há <strong>${params.daysInStage}</strong> dia(s) na etapa <strong>${stage}</strong>
      (limite de alerta: <strong>${params.slaThresholdDays}</strong> dia(s)).
    </p>
    <p style="margin: 0 0 16px; font-size: 14px; color: ${BRAND.textMuted}; line-height: 1.6;">
      Clínica: ${clinic}
    </p>
    ${ctaButton(params.patientUrl, "Abrir ficha do paciente")}
    <p style="margin: 16px 0 0; font-size: 13px; color: ${BRAND.textMuted}; line-height: 1.5;">
      Ou copie o link:
    </p>
    <p style="margin: 4px 0 0; font-size: 12px; color: ${BRAND.textMuted}; word-break: break-all;">
      <a href="${params.patientUrl}" style="color: ${BRAND.link}; text-decoration: underline;">${params.patientUrl}</a>
    </p>
  `;
  return baseLayout(content, {
    preheader: `${badgeLabel}: ${patient} — ${stage}`,
    brandName: params.clinicName,
  });
}

/** Staff: checklist da etapa concluído (itens obrigatórios). */
export function getChecklistCompleteStaffHtml(params: {
  staffName: string | null;
  patientName: string;
  stageName: string;
  totalRequiredItems: number;
  clinicName: string;
  patientUrl: string;
}): string {
  const who = escapeHtmlText(params.staffName?.trim() || "Olá");
  const patient = escapeHtmlText(params.patientName);
  const stage = escapeHtmlText(params.stageName);
  const clinic = escapeHtmlText(params.clinicName);
  const n = params.totalRequiredItems;
  const content = `
    <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: ${BRAND.text}; line-height: 1.3;">
      Checklist completo
    </h1>
    <p style="margin: 0 0 16px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      ${who},
    </p>
    <p style="margin: 0 0 8px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      Todos os <strong>${n}</strong> itens obrigatórios da etapa <strong>${stage}</strong> foram concluídos para <strong>${patient}</strong>.
    </p>
    <p style="margin: 0 0 16px; font-size: 14px; color: ${BRAND.textMuted}; line-height: 1.6;">
      Clínica: ${clinic}
    </p>
    ${ctaButton(params.patientUrl, "Abrir ficha do paciente")}
    <p style="margin: 16px 0 0; font-size: 13px; color: ${BRAND.textMuted}; line-height: 1.5;">
      Ou copie o link:
    </p>
    <p style="margin: 4px 0 0; font-size: 12px; color: ${BRAND.textMuted}; word-break: break-all;">
      <a href="${params.patientUrl}" style="color: ${BRAND.link}; text-decoration: underline;">${params.patientUrl}</a>
    </p>
  `;
  return baseLayout(content, {
    preheader: `Checklist completo: ${patient} — ${stage}`,
    brandName: params.clinicName,
  });
}

/** Staff: documento enviado pelo portal aguardando revisão. */
export function getFilePendingReviewStaffHtml(params: {
  staffName: string | null;
  patientName: string;
  fileName: string;
  clinicName: string;
  reviewUrl: string;
}): string {
  const who = escapeHtmlText(params.staffName?.trim() || "Olá");
  const patient = escapeHtmlText(params.patientName);
  const file = escapeHtmlText(params.fileName);
  const clinic = escapeHtmlText(params.clinicName);
  const content = `
    <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: ${BRAND.text}; line-height: 1.3;">
      Documento para revisar
    </h1>
    <p style="margin: 0 0 16px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      ${who},
    </p>
    <p style="margin: 0 0 8px; font-size: 15px; color: ${BRAND.text}; line-height: 1.6;">
      <strong>${patient}</strong> enviou o arquivo <strong>${file}</strong> pela clínica <strong>${clinic}</strong>.
    </p>
    ${ctaButton(params.reviewUrl, "Revisar documento")}
    <p style="margin: 16px 0 0; font-size: 13px; color: ${BRAND.textMuted}; line-height: 1.5;">
      Ou copie o link:
    </p>
    <p style="margin: 4px 0 0; font-size: 12px; color: ${BRAND.textMuted}; word-break: break-all;">
      <a href="${params.reviewUrl}" style="color: ${BRAND.link}; text-decoration: underline;">${params.reviewUrl}</a>
    </p>
  `;
  return baseLayout(content, {
    preheader: `Novo documento: ${file} — ${clinic}`,
    brandName: params.clinicName,
  });
}

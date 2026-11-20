/**
 * Templates HTML transacionais (Resend / SMTP do tenant).
 *
 * Visual do kit "SubManager · Conceito Digital": fundo pedra claro, cartão branco de cantos 20,
 * tinta petróleo no botão, azul céu só para marcar e estados sempre com palavra (nunca só cor).
 * Layout em tabelas e estilos inline (compatível com Gmail, Outlook e Apple Mail).
 * Sem travessão no texto, conforme o guia de escrita do kit.
 */

import { getPublicAppUrl } from "@/lib/config/urls";

/** Tokens do kit para e-mail (tema claro fixo; clientes que forçam escuro invertem sozinhos). */
const KIT = {
  pageBg: "#eef1f3",
  card: "#fcfdfd",
  surface: "#f6f8f9",
  tint: "#e3e8ec",
  line: "#d9e0e5",
  ink: "#0e1d29",
  onInk: "#eef1f3",
  text: "#33434f",
  muted: "#556572",
  accent: "#1d5878",
  brand: "#2b7a9e",
  sky: "#8ec3db",
  skySoft: "#dcebf3",
  good: "#22704a",
  goodSoft: "#e1efe6",
  warn: "#985710",
  warnSoft: "#f7e9d5",
  bad: "#a4382c",
  badSoft: "#f6e0dc",
} as const;

const FONT = "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

type Tone = "ok" | "warn" | "bad" | "info" | "neutral";

const TONE: Record<Tone, { bg: string; fg: string }> = {
  ok: { bg: KIT.goodSoft, fg: KIT.good },
  warn: { bg: KIT.warnSoft, fg: KIT.warn },
  bad: { bg: KIT.badSoft, fg: KIT.bad },
  info: { bg: KIT.skySoft, fg: KIT.accent },
  neutral: { bg: KIT.tint, fg: KIT.text },
};

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function firstName(full: string): string {
  const trimmed = full.trim();
  return trimmed.split(/\s+/)[0] || trimmed;
}

/** "Olá, Ana." ou só "Olá." quando não há nome. */
function hello(name: string | null | undefined): string {
  const first = firstName(name || "");
  return first ? `Olá, ${escapeHtmlText(first)}.` : "Olá.";
}

/** Até duas iniciais para o selo da marca no topo do e-mail. */
function brandInitials(name: string): string {
  const words = name
    .replace(/[^A-Za-zÀ-ÿ0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-ZÀ-Þ]/.test(w));
  if (words.length === 0) return "SM";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

type BaseLayoutOptions = {
  preheader?: string;
  brandName?: string;
  /** Rótulo pequeno acima do título (categoria do e-mail). */
  eyebrow?: string;
};

function baseLayout(content: string, preheaderOrOptions?: string | BaseLayoutOptions): string {
  const options: BaseLayoutOptions =
    preheaderOrOptions === undefined
      ? {}
      : typeof preheaderOrOptions === "string"
        ? { preheader: preheaderOrOptions }
        : preheaderOrOptions;
  const brandRaw = options.brandName?.trim() || "SubManager";
  const brandLabel = escapeHtmlText(brandRaw);
  const initials = escapeHtmlText(brandInitials(brandRaw));
  const isPlatform = brandRaw === "SubManager";
  const base = escapeHtmlText(getPublicAppUrl());
  const preheader = options.preheader ? escapeHtmlText(options.preheader) : "";
  const eyebrow = options.eyebrow
    ? `<p style="margin: 0 0 10px; font-family: ${FONT}; font-size: 12px; font-weight: 600; letter-spacing: 1.6px; text-transform: uppercase; color: ${KIT.accent};">${escapeHtmlText(options.eyebrow)}</p>`
    : "";
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${brandLabel}</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&amp;display=swap" rel="stylesheet">
  <style type="text/css">
    #preheader { display: none !important; visibility: hidden; opacity: 0; height: 0; width: 0; overflow: hidden; mso-hide: all; }
    a { color: ${KIT.accent}; }
    @media (max-width: 600px) {
      .sm-pad { padding-left: 24px !important; padding-right: 24px !important; }
      .sm-h1 { font-size: 24px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${KIT.pageBg}; font-family: ${FONT}; -webkit-font-smoothing: antialiased;">
  ${preheader ? `<span id="preheader">${preheader}</span>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${KIT.pageBg};">
    <tr>
      <td align="center" style="padding: 32px 16px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px;">
          <tr>
            <td style="padding: 0 4px 16px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="36" height="36" align="center" valign="middle" style="width: 36px; height: 36px; border-radius: 11px; background-color: ${KIT.ink}; font-family: ${FONT}; font-size: 13px; font-weight: 800; color: ${KIT.sky};">${initials}</td>
                  <td style="padding-left: 12px; font-family: ${FONT}; font-size: 18px; font-weight: 800; letter-spacing: -0.4px; color: ${KIT.ink};">${brandLabel}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="sm-pad" style="padding: 36px 40px 40px; background-color: ${KIT.card}; border: 1px solid ${KIT.line}; border-radius: 20px;">
              ${eyebrow}
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 8px 0; text-align: center; font-family: ${FONT};">
              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: ${KIT.muted};">
                ${isPlatform ? "Enviado pelo SubManager" : `Enviado por ${brandLabel} pelo SubManager`}, plataforma de jornadas clínicas.
              </p>
              <p style="margin: 6px 0 0; font-size: 12px; line-height: 1.6;">
                <a href="${base}" style="color: ${KIT.accent}; font-weight: 600; text-decoration: none;">Abrir o SubManager</a>
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

function h1(text: string): string {
  return `<h1 class="sm-h1" style="margin: 0 0 14px; font-family: ${FONT}; font-size: 28px; font-weight: 800; letter-spacing: -0.8px; line-height: 1.15; color: ${KIT.ink};">${text}</h1>`;
}

function para(html: string, opts: { muted?: boolean; size?: number; mb?: number } = {}): string {
  return `<p style="margin: 0 0 ${opts.mb ?? 14}px; font-family: ${FONT}; font-size: ${opts.size ?? 15}px; line-height: 1.6; color: ${opts.muted ? KIT.muted : KIT.text};">${html}</p>`;
}

function strong(text: string): string {
  return `<strong style="color: ${KIT.ink}; font-weight: 600;">${text}</strong>`;
}

/** Botão principal (tinta). Um por e-mail. */
function ctaButton(href: string, label: string): string {
  const safeHref = escapeHtmlText(href);
  return `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 26px 0 8px;">
  <tr>
    <td style="border-radius: 12px; background-color: ${KIT.ink};">
      <a href="${safeHref}" style="display: inline-block; padding: 14px 26px; font-family: ${FONT}; font-size: 15px; font-weight: 600; line-height: 1.2; color: ${KIT.onInk}; text-decoration: none; border-radius: 12px;">${escapeHtmlText(label)} &rarr;</a>
    </td>
  </tr>
</table>
`.trim();
}

/** Link de reserva em texto, para quando o botão não abrir. */
function fallbackLink(href: string): string {
  const safe = escapeHtmlText(href);
  return `<p style="margin: 14px 0 0; font-family: ${FONT}; font-size: 12px; line-height: 1.6; color: ${KIT.muted}; word-break: break-all;">Se o botão não abrir, copie e cole no navegador:<br><a href="${safe}" style="color: ${KIT.accent}; text-decoration: underline;">${safe}</a></p>`;
}

/** Nota final do e-mail (separada por linha). */
function footnote(html: string): string {
  return `<p style="margin: 26px 0 0; padding-top: 18px; border-top: 1px solid ${KIT.line}; font-family: ${FONT}; font-size: 12px; line-height: 1.6; color: ${KIT.muted};">${html}</p>`;
}

/** Selo de estado com palavra (cor nunca sozinha). */
function pill(label: string, tone: Tone): string {
  const t = TONE[tone];
  return `<span style="display: inline-block; padding: 5px 12px; border-radius: 999px; background-color: ${t.bg}; font-family: ${FONT}; font-size: 12px; font-weight: 600; color: ${t.fg};">${escapeHtmlText(label)}</span>`;
}

/** Caixa de aviso tingida (título + texto). */
function notice(tone: Tone, title: string, bodyHtml: string): string {
  const t = TONE[tone];
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 4px 0 16px;">
  <tr>
    <td style="padding: 14px 16px; border-radius: 14px; background-color: ${t.bg}; font-family: ${FONT};">
      <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: ${t.fg};">${escapeHtmlText(title)}</p>
      <p style="margin: 0; font-size: 14px; line-height: 1.55; color: ${KIT.text};">${bodyHtml}</p>
    </td>
  </tr>
</table>
`.trim();
}

/** Tabela de dados rótulo/valor sobre a superfície suave. */
function factTable(rows: { label: string; valueHtml: string }[]): string {
  const cells = rows
    .map(
      (r, i) => `
  <tr>
    <td style="padding: 11px 16px; ${i > 0 ? `border-top: 1px solid ${KIT.line};` : ""} font-family: ${FONT}; font-size: 13px; color: ${KIT.muted}; width: 40%;">${escapeHtmlText(r.label)}</td>
    <td style="padding: 11px 16px; ${i > 0 ? `border-top: 1px solid ${KIT.line};` : ""} font-family: ${FONT}; font-size: 14px; font-weight: 600; color: ${KIT.ink};">${r.valueHtml}</td>
  </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 6px 0 4px; border-radius: 14px; background-color: ${KIT.surface}; border: 1px solid ${KIT.line};">${cells}</table>`;
}

/** Recuperação de senha. */
export function getResetPasswordHtml(params: { name: string | null; resetUrl: string }): string {
  const content = `
    ${h1("Redefinir sua senha")}
    ${para(`${hello(params.name)} Recebemos um pedido para criar uma nova senha para a sua conta.`)}
    ${para("Toque no botão para escolher a nova senha. Depois é só entrar normalmente.")}
    ${ctaButton(params.resetUrl, "Criar nova senha")}
    ${fallbackLink(params.resetUrl)}
    ${footnote("O link vale por 1 hora e só funciona uma vez. Se você não pediu a troca, ignore este e-mail: sua senha atual continua valendo.")}
  `;
  return baseLayout(content, { preheader: "Crie uma nova senha para entrar no SubManager.", eyebrow: "Acesso" });
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
  const tenantName = escapeHtmlText(params.tenantName);
  const rows = [{ label: "Clínica", valueHtml: tenantName }];
  if (params.tenantTaxIdDisplay) {
    rows.push({ label: "CNPJ", valueHtml: escapeHtmlText(params.tenantTaxIdDisplay) });
  }
  const content = `
    ${h1("Você foi convidado para a equipe")}
    ${para(`${hello(params.name)} Uma conta no SubManager foi criada para você acompanhar as jornadas dos pacientes desta clínica.`)}
    ${factTable(rows)}
    ${para("Defina sua senha para fazer o primeiro acesso.", { mb: 0 })}
    ${ctaButton(params.setPasswordUrl, "Definir minha senha")}
    ${fallbackLink(params.setPasswordUrl)}
    ${footnote("O convite vale por 48 horas. Se você não esperava este convite, ignore este e-mail.")}
  `;
  return baseLayout(content, {
    preheader: `Defina sua senha para entrar na equipe de ${params.tenantName.trim()}.`,
    brandName: params.tenantName,
    eyebrow: "Convite",
  });
}

/** Usuário que já tem conta foi adicionado a mais uma clínica (a senha não muda). */
export function getTenantMemberAddedHtml(params: { name: string | null; tenantName: string; appUrl: string }): string {
  const clinic = escapeHtmlText(params.tenantName.trim());
  const content = `
    ${h1("Você agora faz parte desta clínica")}
    ${para(`${hello(params.name)} Sua conta no SubManager foi adicionada à clínica ${strong(clinic)}.`)}
    ${notice("info", "Sua senha não mudou", "Entre com o mesmo e-mail e senha de sempre. A troca entre clínicas fica no topo do painel.")}
    ${ctaButton(params.appUrl, "Abrir o SubManager")}
    ${footnote("Se você não esperava este acesso, fale com a clínica ou com o suporte.")}
  `;
  return baseLayout(content, {
    preheader: `Sua conta foi adicionada a ${params.tenantName.trim()}.`,
    brandName: params.tenantName,
    eyebrow: "Equipe",
  });
}

/**
 * Paciente: cadastro público concluído — confirmação + boas-vindas.
 */
export function getPatientSelfRegisterWelcomeHtml(params: {
  patientName: string;
  clinicName: string;
  portalLoginUrl: string;
}): string {
  const greeting = escapeHtmlText(firstName(params.patientName));
  const clinic = escapeHtmlText(params.clinicName);
  const content = `
    ${h1("Cadastro recebido")}
    ${para(`Olá, ${greeting}. Recebemos seus dados e a equipe da ${strong(clinic)} já pode acompanhar seu cadastro.`)}
    ${notice("ok", "Próximo passo", "Alguém da clínica vai falar com você pelo telefone ou WhatsApp informado para combinar o seu tratamento.")}
    ${para("Quando quiser, entre no portal do paciente com o e-mail ou CPF e a senha que você criou.", { mb: 0 })}
    ${ctaButton(params.portalLoginUrl, "Abrir portal do paciente")}
    ${fallbackLink(params.portalLoginUrl)}
    ${footnote("Se você não fez este cadastro, ignore este e-mail ou fale com a clínica.")}
  `;
  return baseLayout(content, {
    preheader: `${params.clinicName.trim()} recebeu seu cadastro.`,
    brandName: params.clinicName,
    eyebrow: "Boas-vindas",
  });
}

/** Equipe da clínica: paciente concluiu auto-cadastro pelo link/QR. */
export function getPatientSelfRegisteredStaffHtml(params: {
  staffName: string | null;
  patientName: string;
  clinicName: string;
  openPatientUrl: string;
}): string {
  const who = escapeHtmlText(firstName(params.staffName || "") || "Olá");
  const patient = escapeHtmlText(params.patientName);
  const content = `
    ${h1("Novo paciente pelo formulário")}
    ${para(`${who}, ${strong(patient)} acabou de concluir o cadastro pelo link ou QR da clínica.`)}
    ${notice("info", "O que fazer agora", "Abra a ficha e escolha a jornada de tratamento deste paciente.")}
    ${ctaButton(params.openPatientUrl, "Abrir ficha do paciente")}
    ${fallbackLink(params.openPatientUrl)}
    ${footnote("Você recebeu este aviso por fazer parte da equipe desta clínica no SubManager.")}
  `;
  return baseLayout(content, {
    preheader: `${params.patientName.trim()} concluiu o cadastro. Escolha a jornada.`,
    brandName: params.clinicName,
    eyebrow: "Novo paciente",
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
  const patient = escapeHtmlText(firstName(params.patientName));
  const clinic = escapeHtmlText(params.clinicName);
  const reuseNote = params.singleUse
    ? "O link vale por 72 horas e funciona uma única vez."
    : "O link vale por 72 horas e pode ser aberto mais de uma vez até lá. Guarde em lugar seguro.";
  const content = `
    ${h1("Acompanhe seu tratamento")}
    ${para(`Olá, ${patient}. A ${strong(clinic)} liberou seu acesso ao portal do paciente.`)}
    ${para("Lá você vê a etapa em que está, os documentos da clínica e pode enviar os seus.", { mb: 0 })}
    ${ctaButton(params.enterUrl, "Abrir portal do paciente")}
    ${fallbackLink(params.enterUrl)}
    ${footnote(`${reuseNote} Se você não pediu este acesso, ignore este e-mail.`)}
  `;
  return baseLayout(content, {
    preheader: `Seu acesso ao portal de ${params.clinicName.trim()}.`,
    brandName: params.clinicName,
    eyebrow: "Portal do paciente",
  });
}

/** Paciente: código para entrar no portal com CPF (OTP). */
export function getPatientPortalOtpHtml(params: {
  patientName: string;
  clinicName: string;
  code: string;
}): string {
  const patient = escapeHtmlText(firstName(params.patientName));
  const clinic = escapeHtmlText(params.clinicName);
  const code = escapeHtmlText(params.code);
  const content = `
    ${h1("Seu código de acesso")}
    ${para(`Olá, ${patient}. Digite este código no portal da ${strong(clinic)} para entrar.`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 8px 0 6px;">
      <tr>
        <td align="center" style="padding: 22px 16px; border-radius: 16px; background-color: ${KIT.skySoft}; font-family: ${FONT}; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: ${KIT.ink};">${code}</td>
      </tr>
    </table>
    ${para("O código vale por poucos minutos.", { muted: true, size: 13, mb: 0 })}
    ${footnote("Se você não pediu este código, ignore este e-mail. Ninguém da clínica vai pedir esse número por telefone.")}
  `;
  return baseLayout(content, {
    preheader: `Seu código para entrar no portal: ${params.code}`,
    brandName: params.clinicName,
    eyebrow: "Portal do paciente",
  });
}

/** Paciente: resultado da revisão de arquivo enviado pelo portal (aprovado ou recusado). */
export function getFileReviewResultPatientHtml(params: {
  patientName: string;
  clinicName: string;
  fileName: string;
  decision: "approve" | "reject";
  rejectReason?: string;
  portalUrl: string;
}): string {
  const greeting = escapeHtmlText(firstName(params.patientName));
  const clinic = escapeHtmlText(params.clinicName);
  const file = escapeHtmlText(params.fileName);
  const isApproved = params.decision === "approve";
  const reason = params.rejectReason?.trim();

  const status = isApproved
    ? notice("ok", "Documento aprovado", `${file} foi conferido e aceito pela equipe da ${clinic}.`)
    : notice(
        "warn",
        "Documento precisa de ajuste",
        `${file} voltou para você corrigir.${reason ? `<br><strong style="color: ${KIT.ink};">Motivo:</strong> ${escapeHtmlText(reason)}` : ""}`,
      );

  const content = `
    ${h1(isApproved ? "Seu documento foi aprovado" : "Seu documento precisa de ajuste")}
    ${para(`Olá, ${greeting}.`)}
    ${status}
    ${isApproved ? "" : para("Envie uma nova versão pelo portal. A clínica confere de novo assim que chegar.", { mb: 0 })}
    ${ctaButton(params.portalUrl, isApproved ? "Abrir portal do paciente" : "Enviar nova versão")}
    ${fallbackLink(params.portalUrl)}
    ${footnote("Você recebeu este e-mail porque enviou um documento pelo portal da clínica. Se não reconhece este envio, ignore esta mensagem.")}
  `;
  return baseLayout(content, {
    preheader: isApproved
      ? `${params.fileName} foi aprovado por ${params.clinicName.trim()}.`
      : `${params.fileName} precisa de ajuste.`,
    brandName: params.clinicName,
    eyebrow: "Documentos",
  });
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
  const greeting = escapeHtmlText(firstName(params.patientName));
  const clinic = escapeHtmlText(params.clinicName);
  const stage = escapeHtmlText(params.stageName);
  const message = params.patientMessage?.trim();

  const stageCard = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 6px 0 16px;">
  <tr>
    <td style="padding: 18px 20px; border-radius: 16px; background-color: ${KIT.ink}; font-family: ${FONT};">
      <p style="margin: 0 0 4px; font-size: 11px; font-weight: 600; letter-spacing: 1.6px; text-transform: uppercase; color: ${KIT.sky};">Etapa atual</p>
      <p style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.3px; color: ${KIT.onInk};">${stage}</p>
    </td>
  </tr>
</table>`.trim();

  const messageBlock = message
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 16px;"><tr><td style="padding: 14px 16px; border-radius: 14px; background-color: ${KIT.surface}; border: 1px solid ${KIT.line}; font-family: ${FONT}; font-size: 15px; line-height: 1.6; color: ${KIT.text};"><span style="display: block; margin-bottom: 4px; font-size: 12px; font-weight: 600; color: ${KIT.muted};">Recado da clínica</span>${escapeHtmlText(message)}</td></tr></table>`
    : "";

  const docsBlock =
    params.documents.length > 0
      ? `<p style="margin: 0 0 8px; font-family: ${FONT}; font-size: 14px; font-weight: 600; color: ${KIT.ink};">Documentos desta etapa</p>
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 6px; border-radius: 14px; border: 1px solid ${KIT.line};">
           ${params.documents
             .map(
               (d, i) => `<tr><td style="padding: 11px 16px; ${i > 0 ? `border-top: 1px solid ${KIT.line};` : ""} font-family: ${FONT}; font-size: 14px; color: ${KIT.ink};"><span style="display: inline-block; margin-right: 10px; padding: 2px 6px; border-radius: 6px; background-color: ${KIT.skySoft}; font-size: 10px; font-weight: 700; color: ${KIT.accent};">DOC</span>${escapeHtmlText(d.fileName)}</td></tr>`,
             )
             .join("")}
         </table>
         ${para("Os arquivos ficam no portal, prontos para abrir.", { muted: true, size: 13, mb: 0 })}`
      : "";

  const content = `
    ${h1("Você avançou no tratamento")}
    ${para(`Olá, ${greeting}. A equipe da ${strong(clinic)} registrou sua entrada em uma nova etapa.`)}
    ${stageCard}
    ${messageBlock}
    ${docsBlock}
    ${ctaButton(params.portalUrl, "Abrir portal do paciente")}
    ${fallbackLink(params.portalUrl)}
    ${footnote("Você recebeu este e-mail porque sua jornada na clínica foi atualizada.")}
  `;
  return baseLayout(content, {
    preheader: `Nova etapa: ${params.stageName.trim()}.`,
    brandName: params.clinicName,
    eyebrow: "Sua jornada",
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
  const who = escapeHtmlText(firstName(params.staffName || "") || "Olá");
  const patient = escapeHtmlText(params.patientName);
  const stage = escapeHtmlText(params.stageName);
  const isDanger = params.severity === "danger";
  const label = isDanger ? "Crítico" : "Atenção";
  const days = params.daysInStage;
  const daysLabel = `${days} ${days === 1 ? "dia" : "dias"}`;
  const limitLabel = `${params.slaThresholdDays} ${params.slaThresholdDays === 1 ? "dia" : "dias"}`;
  const content = `
    <p style="margin: 0 0 14px;">${pill(label, isDanger ? "bad" : "warn")}</p>
    ${h1(isDanger ? "Paciente passou do prazo crítico" : "Paciente perto do prazo")}
    ${para(`${who}, ${strong(patient)} está parado na mesma etapa há mais tempo que o combinado.`)}
    ${factTable([
      { label: "Paciente", valueHtml: patient },
      { label: "Etapa", valueHtml: stage },
      {
        label: "Tempo na etapa",
        valueHtml: `<span style="color: ${isDanger ? KIT.bad : KIT.warn};">${escapeHtmlText(daysLabel)}</span>`,
      },
      { label: isDanger ? "Crítico após" : "Alerta após", valueHtml: escapeHtmlText(limitLabel) },
    ])}
    ${ctaButton(params.patientUrl, "Abrir ficha do paciente")}
    ${fallbackLink(params.patientUrl)}
    ${footnote("Você recebeu este alerta porque é responsável por esta etapa ou pela clínica. Os prazos são definidos em Jornadas.")}
  `;
  return baseLayout(content, {
    preheader: `${label}: ${params.patientName.trim()} há ${daysLabel} em ${params.stageName.trim()}.`,
    brandName: params.clinicName,
    eyebrow: "Alerta de prazo",
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
  const who = escapeHtmlText(firstName(params.staffName || "") || "Olá");
  const patient = escapeHtmlText(params.patientName);
  const stage = escapeHtmlText(params.stageName);
  const n = params.totalRequiredItems;
  const itemsLabel = `${n} ${n === 1 ? "item obrigatório" : "itens obrigatórios"}`;
  const content = `
    <p style="margin: 0 0 14px;">${pill("Checklist completo", "ok")}</p>
    ${h1("Pronto para mudar de etapa")}
    ${para(`${who}, todos os itens obrigatórios de ${strong(patient)} nesta etapa foram concluídos.`)}
    ${factTable([
      { label: "Paciente", valueHtml: patient },
      { label: "Etapa", valueHtml: stage },
      { label: "Checklist", valueHtml: `<span style="color: ${KIT.good};">${escapeHtmlText(itemsLabel)} concluídos</span>` },
    ])}
    ${ctaButton(params.patientUrl, "Abrir ficha do paciente")}
    ${fallbackLink(params.patientUrl)}
  `;
  return baseLayout(content, {
    preheader: `Checklist completo: ${params.patientName.trim()} pode avançar de ${params.stageName.trim()}.`,
    brandName: params.clinicName,
    eyebrow: "Checklist",
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
  const who = escapeHtmlText(firstName(params.staffName || "") || "Olá");
  const patient = escapeHtmlText(params.patientName);
  const file = escapeHtmlText(params.fileName);
  const content = `
    <p style="margin: 0 0 14px;">${pill("Aguardando revisão", "warn")}</p>
    ${h1("Documento para revisar")}
    ${para(`${who}, ${strong(patient)} enviou um arquivo pelo portal do paciente.`)}
    ${factTable([
      { label: "Paciente", valueHtml: patient },
      { label: "Arquivo", valueHtml: file },
    ])}
    ${para("O paciente só vê o arquivo liberado depois que alguém da equipe aceitar.", { muted: true, size: 13, mb: 0 })}
    ${ctaButton(params.reviewUrl, "Revisar documento")}
    ${fallbackLink(params.reviewUrl)}
  `;
  return baseLayout(content, {
    preheader: `${params.patientName.trim()} enviou ${params.fileName}.`,
    brandName: params.clinicName,
    eyebrow: "Documentos",
  });
}

/** Staff: lembrete na véspera de uma cirurgia marcada na agenda. */
export function getSurgeryReminderStaffHtml(params: {
  staffName: string | null;
  patientName: string;
  /** Data e hora já formatadas no fuso da clínica (ex.: "quarta, 19/11 às 7h30"). */
  whenLabel: string;
  /** Duração já formatada (ex.: "3 h"). */
  durationLabel: string;
  eventTitle: string;
  stageName: string | null;
  /** Itens obrigatórios do checklist ainda abertos na etapa atual (null quando não há jornada ativa). */
  pendingRequiredItems: number | null;
  notes: string | null;
  clinicName: string;
  openUrl: string;
  openLabel: string;
}): string {
  const who = escapeHtmlText(firstName(params.staffName || "") || "Olá");
  const patient = escapeHtmlText(params.patientName);
  const rows: { label: string; valueHtml: string }[] = [
    { label: "Paciente", valueHtml: patient },
    { label: "Quando", valueHtml: escapeHtmlText(params.whenLabel) },
    { label: "Duração prevista", valueHtml: escapeHtmlText(params.durationLabel) },
    { label: "Compromisso", valueHtml: escapeHtmlText(params.eventTitle) },
  ];
  if (params.stageName) rows.push({ label: "Etapa da jornada", valueHtml: escapeHtmlText(params.stageName) });

  const pending = params.pendingRequiredItems;
  const checklist =
    pending === null
      ? ""
      : pending > 0
        ? notice(
            "warn",
            `${pending} ${pending === 1 ? "item obrigatório em aberto" : "itens obrigatórios em aberto"}`,
            "O checklist da etapa ainda tem pendências. Confira na ficha antes do procedimento.",
          )
        : notice("ok", "Checklist da etapa completo", "Todos os itens obrigatórios da etapa atual já foram concluídos.");

  const notes = params.notes?.trim()
    ? para(`<span style="font-weight: 600; color: ${KIT.ink};">Observações:</span> ${escapeHtmlText(params.notes.trim())}`, { size: 14 })
    : "";

  const content = `
    <p style="margin: 0 0 14px;">${pill("Cirurgia amanhã", "info")}</p>
    ${h1("Lembrete de cirurgia")}
    ${para(`${who}, amanhã tem cirurgia de ${strong(patient)} na agenda da clínica.`)}
    ${factTable(rows)}
    ${checklist ? `<div style="height: 10px; line-height: 10px;">&nbsp;</div>${checklist}` : ""}
    ${notes}
    ${ctaButton(params.openUrl, params.openLabel)}
    ${fallbackLink(params.openUrl)}
    ${footnote("Você recebeu este lembrete por ser responsável pelo compromisso ou pela etapa do paciente. Dá para desligar em Configurações, Notificações.")}
  `;
  return baseLayout(content, {
    preheader: `Amanhã: cirurgia de ${params.patientName.trim()}, ${params.whenLabel}.`,
    brandName: params.clinicName,
    eyebrow: "Lembrete",
  });
}

/** Staff (administradores): resumo da semana da clínica. */
export function getWeeklyReportStaffHtml(params: {
  staffName: string | null;
  clinicName: string;
  /** Ex.: "10 a 16 de novembro". */
  periodLabel: string;
  kpis: { patients: number; transitions: number; critical: number; pathways: number };
  byStatus: { ok: number; warning: number; danger: number };
  topStages: { label: string; count: number }[];
  critical: { name: string; stageName: string; daysInStage: number; url: string }[];
  /** Total de casos críticos (a lista mostra só os primeiros). */
  criticalTotal: number;
  reportsUrl: string;
}): string {
  const who = escapeHtmlText(firstName(params.staffName || "") || "Olá");
  const k = params.kpis;

  const kpiCell = (label: string, value: number, color: string) =>
    `<td width="25%" valign="top" style="padding: 14px 12px; font-family: ${FONT};"><p style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.6px; color: ${color};">${value}</p><p style="margin: 2px 0 0; font-size: 12px; line-height: 1.35; color: ${KIT.muted};">${escapeHtmlText(label)}</p></td>`;
  const kpis = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 6px 0 18px; border-radius: 14px; background-color: ${KIT.surface}; border: 1px solid ${KIT.line};">
  <tr>
    ${kpiCell("pacientes no recorte", k.patients, KIT.ink)}
    ${kpiCell("mudanças de etapa", k.transitions, KIT.ink)}
    ${kpiCell("em situação crítica", k.critical, k.critical > 0 ? KIT.bad : KIT.ink)}
    ${kpiCell("jornadas com pacientes", k.pathways, KIT.ink)}
  </tr>
</table>`.trim();

  const s = params.byStatus;
  const total = s.ok + s.warning + s.danger;
  const pct = (n: number) => (total > 0 ? Math.max(Math.round((n / total) * 100), n > 0 ? 4 : 0) : 0);
  const statusBar =
    total > 0
      ? `
<p style="margin: 0 0 8px; font-family: ${FONT}; font-size: 14px; font-weight: 600; color: ${KIT.ink};">Pacientes por prazo</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius: 8px; overflow: hidden;">
  <tr>
    ${s.ok > 0 ? `<td width="${pct(s.ok)}%" height="12" style="background-color: ${KIT.good}; font-size: 0; line-height: 0;">&nbsp;</td>` : ""}
    ${s.warning > 0 ? `<td width="${pct(s.warning)}%" height="12" style="background-color: ${KIT.warn}; font-size: 0; line-height: 0;">&nbsp;</td>` : ""}
    ${s.danger > 0 ? `<td width="${pct(s.danger)}%" height="12" style="background-color: ${KIT.bad}; font-size: 0; line-height: 0;">&nbsp;</td>` : ""}
  </tr>
</table>
<p style="margin: 8px 0 18px; font-family: ${FONT}; font-size: 13px; color: ${KIT.text};">
  <span style="color: ${KIT.good}; font-weight: 600;">Em dia ${s.ok}</span> &nbsp;·&nbsp;
  <span style="color: ${KIT.warn}; font-weight: 600;">Atenção ${s.warning}</span> &nbsp;·&nbsp;
  <span style="color: ${KIT.bad}; font-weight: 600;">Crítico ${s.danger}</span>
</p>`.trim()
      : "";

  const stages =
    params.topStages.length > 0
      ? `<p style="margin: 0 0 8px; font-family: ${FONT}; font-size: 14px; font-weight: 600; color: ${KIT.ink};">Onde estão os pacientes</p>${factTable(
          params.topStages.map((st) => ({ label: st.label, valueHtml: String(st.count) })),
        )}<div style="height: 14px; line-height: 14px;">&nbsp;</div>`
      : "";

  const critical =
    params.critical.length > 0
      ? `<p style="margin: 0 0 8px; font-family: ${FONT}; font-size: 14px; font-weight: 600; color: ${KIT.ink};">Casos críticos${params.criticalTotal > params.critical.length ? ` (${params.critical.length} de ${params.criticalTotal})` : ""}</p>
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 6px; border-radius: 14px; border: 1px solid ${KIT.line};">
           ${params.critical
             .map(
               (c, i) => `<tr><td style="padding: 11px 16px; ${i > 0 ? `border-top: 1px solid ${KIT.line};` : ""} font-family: ${FONT};"><a href="${escapeHtmlText(c.url)}" style="font-size: 14px; font-weight: 600; color: ${KIT.ink}; text-decoration: none;">${escapeHtmlText(c.name)}</a><span style="display: block; font-size: 12px; color: ${KIT.muted};">${escapeHtmlText(c.stageName)}</span></td><td align="right" style="padding: 11px 16px; ${i > 0 ? `border-top: 1px solid ${KIT.line};` : ""} font-family: ${FONT}; white-space: nowrap;">${pill(`${c.daysInStage} ${c.daysInStage === 1 ? "dia" : "dias"}`, "bad")}</td></tr>`,
             )
             .join("")}
         </table>`
      : notice("ok", "Nenhum caso crítico", "Nenhum paciente passou do prazo crítico da etapa nesta semana.");

  const content = `
    ${h1("Resumo da semana")}
    ${para(`${who}, este é o resumo de ${strong(escapeHtmlText(params.periodLabel))} na ${strong(escapeHtmlText(params.clinicName))}.`)}
    ${kpis}
    ${statusBar}
    ${stages}
    ${critical}
    ${ctaButton(params.reportsUrl, "Abrir relatórios")}
    ${footnote("Enviado toda segunda-feira aos administradores da clínica. Dá para desligar em Configurações, Notificações.")}
  `;
  return baseLayout(content, {
    preheader: `${k.critical} em situação crítica e ${k.transitions} mudanças de etapa em ${params.periodLabel}.`,
    brandName: params.clinicName,
    eyebrow: "Relatório semanal",
  });
}

/** Staff: confirmação de que o pacote de documentos de uma etapa foi disparado ao paciente (entrega real é assíncrona). */
export function getDocumentDeliveryStaffHtml(params: {
  staffName: string | null;
  patientName: string;
  stageName: string;
  documents: string[];
  /** Destino já mascarado (ex.: "h***@gmail.com") ou null quando o canal não se aplica. */
  emailTo: string | null;
  whatsappTo: string | null;
  clinicName: string;
  patientUrl: string;
}): string {
  const who = escapeHtmlText(firstName(params.staffName || "") || "Olá");
  const patient = escapeHtmlText(params.patientName);
  const stage = escapeHtmlText(params.stageName);

  const channelRow = (label: string, to: string | null) =>
    to
      ? { label, valueHtml: `${escapeHtmlText(to)} &nbsp;${pill("Disparado", "ok")}` }
      : { label, valueHtml: `<span style="color: ${KIT.muted}; font-weight: 400;">Não enviado</span>` };

  const noChannel = !params.emailTo && !params.whatsappTo;
  const docs = `
<p style="margin: 0 0 8px; font-family: ${FONT}; font-size: 14px; font-weight: 600; color: ${KIT.ink};">${params.documents.length} ${params.documents.length === 1 ? "documento" : "documentos"}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 16px; border-radius: 14px; border: 1px solid ${KIT.line};">
  ${params.documents
    .map(
      (d, i) => `<tr><td style="padding: 11px 16px; ${i > 0 ? `border-top: 1px solid ${KIT.line};` : ""} font-family: ${FONT}; font-size: 14px; color: ${KIT.ink};"><span style="display: inline-block; margin-right: 10px; padding: 2px 6px; border-radius: 6px; background-color: ${KIT.skySoft}; font-size: 10px; font-weight: 700; color: ${KIT.accent};">DOC</span>${escapeHtmlText(d)}</td></tr>`,
    )
    .join("")}
</table>`.trim();

  const content = `
    <p style="margin: 0 0 14px;">${pill(noChannel ? "Sem canal de envio" : "Pacote disparado", noChannel ? "warn" : "ok")}</p>
    ${h1(noChannel ? "Documentos não saíram" : "Documentos disparados ao paciente")}
    ${para(`${who}, ${strong(patient)} entrou na etapa ${strong(stage)} e o pacote de documentos da etapa ${noChannel ? "não tinha para onde ir" : "foi disparado"}.`)}
    ${docs}
    ${factTable([channelRow("WhatsApp", params.whatsappTo), channelRow("E-mail", params.emailTo)])}
    ${
      noChannel
        ? `<div style="height: 10px; line-height: 10px;">&nbsp;</div>${notice("warn", "Complete o cadastro", "Não há e-mail do paciente nem WhatsApp ativo para este envio. Atualize o cadastro ou ligue o WhatsApp em Configurações; os documentos também ficam no portal.")}`
        : para("A entrega e a leitura no WhatsApp aparecem na linha do tempo do paciente.", { muted: true, size: 13, mb: 0 })
    }
    ${ctaButton(params.patientUrl, "Abrir ficha do paciente")}
    ${footnote("Você recebeu esta confirmação porque moveu o paciente de etapa ou é o responsável por ela. Dá para desligar em Configurações, Notificações.")}
  `;
  return baseLayout(content, {
    preheader: noChannel
      ? `Os documentos de ${params.stageName.trim()} não foram enviados a ${params.patientName.trim()}.`
      : `${params.documents.length} documento(s) de ${params.stageName.trim()} disparados para ${params.patientName.trim()}.`,
    brandName: params.clinicName,
    eyebrow: "Documentos",
  });
}

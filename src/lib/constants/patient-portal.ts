/** Cookie httpOnly da sessão do portal do paciente (separada do NextAuth staff). */
export const PATIENT_PORTAL_SESSION_COOKIE = "patient_portal_session";

/** Header enviado pelo browser nas rotas `/api/v1/patient/*` com o slug da clínica da URL. */
export const PATIENT_PORTAL_TENANT_SLUG_HEADER = "x-patient-portal-tenant-slug";

/** Tempo de vida do link mágico enviado por e-mail (ms). */
export const PATIENT_PORTAL_LINK_TTL_MS = 72 * 60 * 60 * 1000;

/** Duração da sessão após troca do token (segundos). */
export const PATIENT_PORTAL_SESSION_MAX_AGE_SEC = 7 * 24 * 60 * 60;

/** OTP por CPF: validade do código. */
export const PATIENT_PORTAL_OTP_TTL_MS = 15 * 60 * 1000;

/** OTP: tentativas máximas de verificação por desafio. */
export const PATIENT_PORTAL_OTP_MAX_ATTEMPTS = 5;

/** Limite de novos códigos OTP por paciente em janela (anti-abuso). */
export const PATIENT_PORTAL_OTP_REQUEST_WINDOW_MS = 60 * 60 * 1000;
export const PATIENT_PORTAL_OTP_MAX_REQUESTS_PER_WINDOW = 5;

/** Login por senha: falhas consecutivas até bloquear o paciente (persistido no banco). */
export const PATIENT_PORTAL_PASSWORD_MAX_FAILED_ATTEMPTS = 5;

/** Login por senha: duração do bloqueio após atingir o limite de falhas (ms). */
export const PATIENT_PORTAL_PASSWORD_LOCKOUT_MS = 15 * 60 * 1000;

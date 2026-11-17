/**
 * Resend Domains API (verificação DNS / envio com domínio próprio).
 * @see https://resend.com/docs/api-reference/domains/create-domain
 */

const RESEND_API = "https://api.resend.com";
const DEFAULT_TIMEOUT_MS = 25_000;

function getApiKey(): string | null {
  const k = process.env.RESEND_API_KEY?.trim();
  return k || null;
}

export function isResendApiConfigured(): boolean {
  return Boolean(getApiKey());
}

export type ResendDomainRecord = {
  record: string;
  name: string;
  type: string;
  ttl: string;
  status: string;
  value: string;
  priority?: number;
};

type ResendDomainStatus = "pending" | "verified" | "failed" | "not_started" | "temporary_failure";

export type ResendDomain = {
  id: string;
  name: string;
  status: ResendDomainStatus;
  region: string;
  created_at: string;
  records: ResendDomainRecord[];
};

type ResendErrorBody = { message?: string; name?: string };

function unwrapDomain(json: unknown): ResendDomain | null {
  if (!json || typeof json !== "object") return null;
  const o = json as { data?: ResendDomain } & Record<string, unknown>;
  const d = o.data ?? (json as ResendDomain);
  if (d && typeof d === "object" && typeof (d as ResendDomain).id === "string" && typeof (d as ResendDomain).name === "string") {
    return d as ResendDomain;
  }
  return null;
}

async function parseJsonOrThrow(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Resposta inválida da API Resend.");
  }
}

function mapError(status: number, body: ResendErrorBody | null): string {
  const m = body?.message?.trim() || "Erro na API Resend";
  if (status === 401) return "Resend: chave de API inválida ou ausente.";
  if (status === 403) return m;
  if (status === 404) return m;
  if (status === 429) return "Resend: limite de requisições. Tente novamente em instantes.";
  return m;
}

export async function resendCreateDomain(name: string): Promise<
  { ok: true; domain: ResendDomain } | { ok: false; error: string }
> {
  const key = getApiKey();
  if (!key) {
    return { ok: false, error: "RESEND_API_KEY não configurada no servidor." };
  }
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${RESEND_API}/domains`, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.toLowerCase().trim() }),
    });
    const json = (await parseJsonOrThrow(res)) as { data?: ResendDomain; error?: ResendErrorBody | null };
    const domain = unwrapDomain(json) ?? (json as { data?: ResendDomain }).data ?? null;
    if (!res.ok || (json as { error?: ResendErrorBody | null }).error) {
      const err = (json as { error?: ResendErrorBody | null }).error;
      return { ok: false, error: mapError(res.status, err ?? { message: "Falha ao criar domínio" }) };
    }
    if (!domain) {
      return { ok: false, error: "Resposta inesperada do Resend ao criar domínio." };
    }
    return { ok: true, domain };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, error: "Resend: tempo de resposta excedido." };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Falha de rede" };
  } finally {
    clearTimeout(t);
  }
}

export async function resendGetDomain(
  id: string,
): Promise<
  { ok: true; domain: ResendDomain } | { ok: false; error: string }
> {
  const key = getApiKey();
  if (!key) {
    return { ok: false, error: "RESEND_API_KEY não configurada no servidor." };
  }
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${RESEND_API}/domains/${encodeURIComponent(id)}`, {
      method: "GET",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}` },
    });
    const json = (await parseJsonOrThrow(res)) as { data?: ResendDomain; error?: ResendErrorBody | null };
    const domain = unwrapDomain(json);
    if (!res.ok || (json as { error?: ResendErrorBody | null }).error) {
      const err = (json as { error?: ResendErrorBody | null }).error;
      return { ok: false, error: mapError(res.status, err ?? { message: "Domínio não encontrado" }) };
    }
    if (!domain) {
      return { ok: false, error: "Resposta inesperada do Resend ao buscar domínio." };
    }
    return { ok: true, domain };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, error: "Resend: tempo de resposta excedido." };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Falha de rede" };
  } finally {
    clearTimeout(t);
  }
}

export async function resendVerifyDomain(
  id: string,
): Promise<
  { ok: true; domain: ResendDomain } | { ok: false; error: string }
> {
  const key = getApiKey();
  if (!key) {
    return { ok: false, error: "RESEND_API_KEY não configurada no servidor." };
  }
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${RESEND_API}/domains/${encodeURIComponent(id)}/verify`, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    });
    const json = (await parseJsonOrThrow(res)) as { data?: ResendDomain; error?: ResendErrorBody | null };
    const domain = unwrapDomain(json);
    if (!res.ok || (json as { error?: ResendErrorBody | null }).error) {
      const err = (json as { error?: ResendErrorBody | null }).error;
      return { ok: false, error: mapError(res.status, err ?? { message: "Falha na verificação" }) };
    }
    if (!domain) {
      return { ok: false, error: "Resposta inesperada do Resend ao verificar." };
    }
    return { ok: true, domain };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, error: "Resend: tempo de resposta excedido." };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Falha de rede" };
  } finally {
    clearTimeout(t);
  }
}

export async function resendDeleteDomain(
  id: string,
): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const key = getApiKey();
  if (!key) {
    return { ok: false, error: "RESEND_API_KEY não configurada no servidor." };
  }
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${RESEND_API}/domains/${encodeURIComponent(id)}`, {
      method: "DELETE",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.status === 204 || res.status === 200) {
      return { ok: true };
    }
    const json = (await parseJsonOrThrow(res)) as { error: ResendErrorBody | null };
    return { ok: false, error: mapError(res.status, json.error ?? { message: "Falha ao remover domínio" }) };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, error: "Resend: tempo de resposta excedido." };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Falha de rede" };
  } finally {
    clearTimeout(t);
  }
}

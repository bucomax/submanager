/** Valor de `pwdv` no cookie a partir do campo do banco (0 = nunca alterada ou legado). */
export function portalPasswordVersionMs(at: Date | null | undefined): number {
  return at?.getTime() ?? 0;
}

export type PatientPortalSessionClaims = {
  clientId: string;
  tenantId: string;
  tenantSlug: string;
  exp: number;
  pwdv: number;
};

/** Claims da sessão do portal; a assinatura/cookie fica na borda (rota). */
export function buildPatientPortalSessionClaims(input: {
  tenant: { id: string; slug: string };
  client: { id: string; portalPasswordChangedAt: Date | null };
  nowMs: number;
  maxAgeSec: number;
}): PatientPortalSessionClaims {
  const { tenant, client, nowMs, maxAgeSec } = input;
  return {
    clientId: client.id,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    exp: Math.floor(nowMs / 1000) + maxAgeSec,
    pwdv: portalPasswordVersionMs(client.portalPasswordChangedAt),
  };
}

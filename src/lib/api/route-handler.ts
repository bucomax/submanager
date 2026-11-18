import type { Session } from "next-auth";
import type { RouteCtx } from "@/types/api/route-context";
import { getApiT, type ApiT } from "@/lib/api/i18n";
import { rateLimit, type RateLimitPreset } from "@/lib/api/rate-limit";
import {
  assertActiveTenantMembership,
  assertTenantAdminOrSuper,
  getActiveTenantIdOr400,
  requireSessionOr401,
  superAdminOr403,
} from "@/lib/auth/guards";

/** `params` do App Router já resolvido (Next 16 entrega `Promise`). */
export type RouteParams = Record<string, string>;

type BaseRouteArgs<P> = { request: Request; session: Session; apiT: ApiT; params: P };
export type SessionRouteArgs<P extends RouteParams = RouteParams> = BaseRouteArgs<P>;
export type TenantRouteArgs<P extends RouteParams = RouteParams> = BaseRouteArgs<P> & {
  tenantId: string;
};

export type TenantRouteOptions = {
  /**
   * `member` (padrão): membership do tenant ativo (ou super_admin).
   * `admin`: `tenant_admin` ou super_admin (`assertTenantAdminOrSuper`; implica membership).
   */
  role?: "member" | "admin";
  /** Chave `errors.*` usada quando `role: "admin"` falha (padrão do guard: gestão de membros). */
  forbiddenMessageKey?: string;
  /** Rate limit extra por usuário, além do preset `api` já aplicado por `requireSessionOr401`. */
  rateLimit?: RateLimitPreset;
};

export type SessionRouteOptions = {
  /** `super_admin` exige `globalRole === "super_admin"` (`superAdminOr403`). */
  role?: "user" | "super_admin";
  rateLimit?: RateLimitPreset;
};

async function resolveParams<P extends RouteParams>(context: RouteCtx<P> | undefined): Promise<P> {
  return (context ? await context.params : {}) as P;
}

/**
 * Cadeia padrão sem tenant: sessão (+ rate limit `api`) → papel global opcional.
 * Rotas `me/*`, `auth/context` e `admin/*` (super_admin).
 */
export function withSessionRoute<P extends RouteParams = RouteParams>(
  handler: (args: SessionRouteArgs<P>) => Promise<Response> | Response,
  options: SessionRouteOptions = {},
) {
  return async (request: Request, context?: RouteCtx<P>): Promise<Response> => {
    const apiT = await getApiT(request);
    const auth = await requireSessionOr401(request, apiT);
    if (auth.response) return auth.response;
    const session = auth.session!;

    if (options.role === "super_admin") {
      const forbidden = await superAdminOr403(session, request, apiT);
      if (forbidden) return forbidden;
    }
    if (options.rateLimit) {
      const limited = await rateLimit(options.rateLimit, session.user.id);
      if (limited) return limited;
    }

    return handler({ request, session, apiT, params: await resolveParams(context) });
  };
}

/**
 * Cadeia padrão do tenant ativo: sessão → tenant ativo → membership (ou admin) → handler.
 * `tenantId` é sempre derivado do JWT, nunca de body/query.
 */
export function withTenantRoute<P extends RouteParams = RouteParams>(
  handler: (args: TenantRouteArgs<P>) => Promise<Response> | Response,
  options: TenantRouteOptions = {},
) {
  return async (request: Request, context?: RouteCtx<P>): Promise<Response> => {
    const apiT = await getApiT(request);
    const auth = await requireSessionOr401(request, apiT);
    if (auth.response) return auth.response;
    const session = auth.session!;

    const tenantCtx = await getActiveTenantIdOr400(session, request, apiT);
    if (tenantCtx.response) return tenantCtx.response;
    const tenantId = tenantCtx.tenantId!;

    const denied =
      options.role === "admin"
        ? await assertTenantAdminOrSuper(session, tenantId, request, apiT, options.forbiddenMessageKey)
        : await assertActiveTenantMembership(session, tenantId, request, apiT);
    if (denied) return denied;

    if (options.rateLimit) {
      const limited = await rateLimit(options.rateLimit, session.user.id);
      if (limited) return limited;
    }

    return handler({ request, session, tenantId, apiT, params: await resolveParams(context) });
  };
}

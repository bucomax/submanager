import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireSessionOr401, superAdminOr403 } from "@/lib/auth/guards";
import { deriveAppTokenKey } from "@/lib/auth/app-scoped-token";
import { appPrismaRepository } from "@/infrastructure/repositories/app.repository";
import type { RouteCtx } from "@/types/api/route-context";

export const dynamic = "force-dynamic";

/**
 * Chave HS256 derivada (HKDF) deste app, para o fornecedor verificar o token do iframe.
 * Cada app tem a sua; o segredo base nunca sai do servidor. Apenas super_admin.
 */
export async function GET(request: Request, ctx: RouteCtx<{ appId: string }>) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const forbidden = await superAdminOr403(auth.session!, request, apiT);
  if (forbidden) return forbidden;

  const { appId } = await ctx.params;
  const app = await appPrismaRepository.findById(appId);
  if (!app) return jsonError("NOT_FOUND", apiT("errors.appNotFound"), 404);

  console.info("[app-token-secret] revealed", { appId, actorUserId: auth.session!.user.id });

  return jsonSuccess(
    {
      appId,
      algorithm: "HS256",
      secretHex: Buffer.from(deriveAppTokenKey(appId)).toString("hex"),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

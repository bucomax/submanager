import { postClientBodySchema } from "@/application/use-cases/client/create-client";
import { convertConversationToClient } from "@/application/use-cases/conversations/convert-conversation-to-client";
import { validateClientOptionalRefs } from "@/application/use-cases/client/validate-client-references";
import { getApiT } from "@/lib/api/i18n";
import { joinTranslatedZodIssues } from "@/lib/api/zod-i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import type { RouteCtx } from "@/types/api/route-context";

export const dynamic = "force-dynamic";

/** Converte um lead sem cadastro em `Client` de verdade e vincula à conversa. */
export async function POST(request: Request, ctx: RouteCtx<{ id: string }>) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const memberErr = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId!, request, apiT);
  if (memberErr) return memberErr;

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = postClientBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      joinTranslatedZodIssues(parsed.error, apiT as (key: string) => string),
      422,
    );
  }

  const refErr = await validateClientOptionalRefs(
    tenantCtx.tenantId!,
    { assignedToUserId: parsed.data.assignedToUserId, opmeSupplierId: parsed.data.opmeSupplierId },
    apiT,
  );
  if (refErr) return refErr;

  const result = await convertConversationToClient({
    tenantId: tenantCtx.tenantId!,
    conversationId: id,
    actorUserId: auth.session!.user.id,
    data: parsed.data,
  });

  if (!result.ok) {
    if (result.reason === "already_linked") {
      return jsonError("CONFLICT", apiT("errors.conversationAlreadyLinked"), 409);
    }
    return jsonError("NOT_FOUND", apiT("errors.conversationNotFound"), 404);
  }

  return jsonSuccess({ client: result.client }, { status: 201 });
}

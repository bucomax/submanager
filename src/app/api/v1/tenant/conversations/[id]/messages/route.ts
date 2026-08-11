import { sendConversationMessage } from "@/application/use-cases/conversations/send-conversation-message";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { sendMessageBodySchema } from "@/lib/validators/contacts";
import type { MessageDto } from "@/types/api/contacts-v1";
import type { RouteCtx } from "@/types/api/route-context";

export const dynamic = "force-dynamic";

/** Envia uma mensagem outbound na conversa (real, via WhatsApp Cloud API quando o tenant estiver configurado). */
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

  const parsed = sendMessageBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.error.flatten().formErrors.join("; "), 422);
  }

  const result = await sendConversationMessage({
    tenantId: tenantCtx.tenantId!,
    conversationId: id,
    actorUserId: auth.session!.user.id,
    body: parsed.data.body,
  });

  if (!result.ok) {
    return jsonError("NOT_FOUND", apiT("errors.conversationNotFound"), 404);
  }

  const dto: MessageDto = {
    id: result.message.id,
    direction: result.message.direction,
    type: result.message.type,
    body: result.message.body,
    status: result.message.status,
    createdAt: result.message.createdAt.toISOString(),
  };

  return jsonSuccess(dto, { status: 201 });
}

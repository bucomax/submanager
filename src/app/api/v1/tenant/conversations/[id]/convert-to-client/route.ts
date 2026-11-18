import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { CONVERT_CONVERSATION_ERRORS } from "@/lib/api/error-tables/conversation";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { CLIENT_REFERENCE_ERRORS } from "@/lib/api/error-tables/client";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { loadConversationVisibilityWhere } from "@/application/use-cases/shared/load-client-visibility-scope";
import { postClientBodySchema } from "@/application/use-cases/client/create-client";
import { convertConversationToClient } from "@/application/use-cases/conversations/convert-conversation-to-client";
import { validateClientOptionalRefs } from "@/application/use-cases/client/validate-client-references";
import { jsonSuccess } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/** Converte um lead sem cadastro em `Client` de verdade e vincula à conversa. */
export const POST = withTenantRoute<{ id: string }>(async ({ request, session, tenantId, apiT, params }) => {
  const { id } = params;

  const parsed = await parseJsonBody(request, postClientBodySchema, apiT);
  if (parsed.response) return parsed.response;

  const refErr = await validateClientOptionalRefs(
    tenantId,
    { assignedToUserId: parsed.data.assignedToUserId, opmeSupplierId: parsed.data.opmeSupplierId },
  );
  if (refErr) return mapUseCaseError(refErr, CLIENT_REFERENCE_ERRORS, apiT);

  const result = await convertConversationToClient({
    tenantId,
    conversationId: id,
    actorUserId: session.user.id,
    data: parsed.data,
    visibility: await loadConversationVisibilityWhere(actorFromSession(session), tenantId),
  });

  if (!result.ok) {
    return mapUseCaseError(result.reason, CONVERT_CONVERSATION_ERRORS, apiT);
  }

  return jsonSuccess({ client: result.client }, { status: 201 });
});

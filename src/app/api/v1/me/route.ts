import { withSessionRoute } from "@/lib/api/route-handler";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { PATCH_ME_ERRORS } from "@/lib/api/error-tables/auth";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { keyBelongsToTenant } from "@/infrastructure/storage/gcs-storage";
import { resolveUserProfileImageUrl } from "@/infrastructure/storage/resolve-user-profile-image-url";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { getActiveTenantIdOr400 } from "@/lib/auth/guards";
import { getSession } from "@/lib/auth/session";
import { parseUserProfileImageGcsKey } from "@/lib/utils/user-profile-image-ref";
import { patchMeBodySchema } from "@/lib/validators/profile";
import { runDeleteMeAccount } from "@/application/use-cases/me/delete-me-account";
import { getMeProfile } from "@/application/use-cases/me/get-me-profile";
import { runPatchMeProfile } from "@/application/use-cases/me/patch-me-profile";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const apiT = await getApiT(request);
  const session = await getSession();
  if (!session?.user?.id) {
    return jsonError("UNAUTHORIZED", apiT("errors.sessionInvalid"), 401);
  }

  const result = await getMeProfile(session.user.id);
  if (!result.ok) {
    return jsonError("UNAUTHORIZED", apiT("errors.accountInvalid"), 401);
  }

  const imageUrl = await resolveUserProfileImageUrl(result.user.image);

  return jsonSuccess({
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      image: result.user.image,
      imageUrl,
      emailVerified: result.user.emailVerified,
      globalRole: result.user.globalRole,
      tenantId: result.user.tenantId,
      tenantRole: result.user.tenantRole,
      createdAt: result.user.createdAt.toISOString(),
    },
  });
}

export const PATCH = withSessionRoute(async ({ request, session, apiT }) => {
  const parsed = await parseJsonBody(request, patchMeBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const gcsKey = parseUserProfileImageGcsKey(
    parsed.data.image === "" || parsed.data.image === null ? null : parsed.data.image,
  );
  if (gcsKey) {
    const tenantCtx = await getActiveTenantIdOr400(session, request, apiT);
    if (tenantCtx.response) return tenantCtx.response;
    if (!keyBelongsToTenant(gcsKey, tenantCtx.tenantId!)) {
      return jsonError("VALIDATION_ERROR", apiT("errors.invalidObjectKey"), 422);
    }
  }

  const data: { name?: string | null; image?: string | null } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.image !== undefined) {
    data.image = parsed.data.image === "" || parsed.data.image === null ? null : parsed.data.image;
  }

  if (Object.keys(data).length === 0) {
    return jsonError("VALIDATION_ERROR", apiT("errors.noFieldsToUpdate"), 422);
  }

  const updated = await runPatchMeProfile({
    sessionUserId: session.user.id,
    patch: data,
  });

  if (!updated.ok) {
    return mapUseCaseError(updated.code, PATCH_ME_ERRORS, apiT);
  }

  const imageUrl = await resolveUserProfileImageUrl(updated.user.image);

  return jsonSuccess({
    user: {
      ...updated.user,
      imageUrl,
    },
  });
});

/** Soft delete da própria conta (invalida sessões persistidas no Prisma Adapter). */
export const DELETE = withSessionRoute(async ({ session, apiT }) => {
  const result = await runDeleteMeAccount(session.user.id);
  if (!result.ok) {
    return jsonError("UNAUTHORIZED", apiT("errors.accountInvalid"), 401);
  }

  return jsonSuccess({ message: apiT("success.accountDeactivated") });
});

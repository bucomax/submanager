import { formatZodIssues } from "@/lib/api/zod-error";
import { keyBelongsToTenant } from "@/infrastructure/storage/gcs-storage";
import { resolveUserProfileImageUrl } from "@/infrastructure/storage/resolve-user-profile-image-url";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { getActiveTenantIdOr400, requireSessionOr401 } from "@/lib/auth/guards";
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

export async function PATCH(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = patchMeBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const gcsKey = parseUserProfileImageGcsKey(
    parsed.data.image === "" || parsed.data.image === null ? null : parsed.data.image,
  );
  if (gcsKey) {
    const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
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
    sessionUserId: auth.session!.user.id,
    patch: data,
  });

  if (!updated.ok) {
    if (updated.code === "ACCOUNT_INVALID") {
      return jsonError("UNAUTHORIZED", apiT("errors.accountInvalid"), 401);
    }
    return jsonError("VALIDATION_ERROR", apiT("errors.noFieldsToUpdate"), 422);
  }

  const imageUrl = await resolveUserProfileImageUrl(updated.user.image);

  return jsonSuccess({
    user: {
      ...updated.user,
      imageUrl,
    },
  });
}

/** Soft delete da própria conta (invalida sessões persistidas no Prisma Adapter). */
export async function DELETE(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const result = await runDeleteMeAccount(auth.session!.user.id);
  if (!result.ok) {
    return jsonError("UNAUTHORIZED", apiT("errors.accountInvalid"), 401);
  }

  return jsonSuccess({ message: apiT("success.accountDeactivated") });
}

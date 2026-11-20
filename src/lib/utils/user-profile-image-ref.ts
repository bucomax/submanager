/** Prefixo persistido em `User.image` quando a foto está no GCS (sem depender de URL pública estável). */
export const USER_PROFILE_IMAGE_GCS_PREFIX = "gcs:" as const;

export function formatUserProfileImageGcsRef(objectKey: string): string {
  return `${USER_PROFILE_IMAGE_GCS_PREFIX}${objectKey}`;
}

export function parseUserProfileImageGcsKey(image: string | null | undefined): string | null {
  if (!image?.startsWith(USER_PROFILE_IMAGE_GCS_PREFIX)) return null;
  const key = image.slice(USER_PROFILE_IMAGE_GCS_PREFIX.length).trim();
  return key.length > 0 ? key : null;
}

/** Fotos de perfil ficam só em `tenants/{tenantId}/avatars/{arquivo}` (ver `buildUploadObjectKey` com categoria `avatars`). */
const USER_AVATAR_OBJECT_KEY = /^tenants\/([^/]+)\/avatars\/([^/]+)$/;

/**
 * `true` quando a chave é uma foto de perfil de usuário. Com `tenantId`, exige que seja desse tenant.
 * Qualquer outro prefixo (`clients/`, `library/`, `exports/`…) é rejeitado: evita transformar `User.image`
 * em URL assinada de exame/documento.
 */
export function isUserAvatarObjectKey(key: string, tenantId?: string): boolean {
  const match = USER_AVATAR_OBJECT_KEY.exec(key);
  if (!match) return false;
  const [, keyTenantId, fileName] = match;
  if (fileName === "." || fileName === "..") return false;
  return tenantId === undefined || keyTenantId === tenantId;
}

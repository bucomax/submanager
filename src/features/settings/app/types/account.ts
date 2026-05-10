export type TenantRole = "tenant_admin" | "tenant_user";

export type MeUser = {
  id: string;
  email: string;
  name: string | null;
  /** Valor persistido: URL http(s) ou `gcs:{objectKey}`. */
  image: string | null;
  /** URL resolvida para `<img src>` (presign ou base pública); ausente se não houver imagem. */
  imageUrl: string | null;
  emailVerified: string | null;
  globalRole: string;
  tenantId: string | null;
  tenantRole: string | null;
  createdAt: string;
};

export type TenantMemberRow = {
  userId: string;
  email: string;
  name: string | null;
  image: string | null;
  imageUrl: string | null;
  role: TenantRole;
  hasPassword: boolean;
};

export type AdminInviteInput = {
  email: string;
  name?: string;
  tenantId: string;
  role: TenantRole;
};

export type AdminInviteResult = {
  message: string;
  email: string;
  /** userId do usuário convidado ou readicionado. */
  userId: string;
  /** Quando false, nenhum e-mail foi enviado (ex.: usuário já tinha senha e só foi readicionado ao tenant). */
  emailDispatched?: boolean;
  /** Presente quando emailDispatched === false e havia e-mail a enviar. */
  emailError?: string | null;
};

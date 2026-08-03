export type ActiveTenantBySlugRow = { id: string; name: string; slug: string };

export type TenantSummaryRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
};

export type TenantMembershipListRow = {
  userId: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  restrictedToAssignedOnly: boolean;
  linkedOpmeSupplierId: string | null;
  hasPassword: boolean;
};

export type CreateTenantInput = {
  name: string;
  slug: string;
  taxId?: string | null;
  phone?: string | null;
  addressLine?: string | null;
  city?: string | null;
  postalCode?: string | null;
};

export type CreatedTenantRow = {
  id: string;
  name: string;
  slug: string;
  taxId: string | null;
  phone: string | null;
  addressLine: string | null;
  city: string | null;
  postalCode: string | null;
};

export type CreateTenantResult =
  | { ok: true; tenant: CreatedTenantRow }
  | { ok: false; code: "SLUG_CONFLICT" };

export type TenantWhatsAppRow = {
  whatsappEnabled: boolean;
  whatsappPhoneNumberId: string | null;
  whatsappBusinessAccountId: string | null;
  whatsappAccessTokenEnc: string | null;
  whatsappVerifiedAt: Date | null;
};

/** Campos persistidos; token já criptografado ou null para limpar. */
export type TenantWhatsAppPatchInput = {
  whatsappEnabled?: boolean;
  whatsappPhoneNumberId?: string | null;
  whatsappBusinessAccountId?: string | null;
  whatsappAccessTokenEnc?: string | null;
  /** Quando true, zera `whatsappVerifiedAt` (ex.: troca de token). */
  resetWhatsAppVerifiedAt?: boolean;
};

export type TenantNotificationPrefsRow = {
  notifyCriticalAlerts: boolean;
  notifySurgeryReminders: boolean;
  notifyNewPatients: boolean;
  notifyWeeklyReport: boolean;
  notifyDocumentDelivery: boolean;
};

export type TenantClinicProfileRow = {
  id: string;
  name: string;
  slug: string;
  taxId: string | null;
  phone: string | null;
  addressLine: string | null;
  city: string | null;
  postalCode: string | null;
  affiliatedHospitals: string | null;
};

export type TenantClinicProfilePatchInput = {
  name?: string;
  taxId?: string | null;
  phone?: string | null;
  addressLine?: string | null;
  city?: string | null;
  postalCode?: string | null;
  affiliatedHospitals?: string | null;
};

export interface ITenantRepository {
  findById(tenantId: string): Promise<unknown | null>;
  findBySlug(slug: string): Promise<unknown | null>;
  findAll(): Promise<unknown[]>;
  /** Tenant ativo com slug case-insensitive (rotas públicas com slug na URL). */
  findActiveBySlugCaseInsensitive(slug: string): Promise<ActiveTenantBySlugRow | null>;
  countTenantAdmins(tenantId: string): Promise<number>;
  findMembership(tenantId: string, userId: string): Promise<unknown | null>;
  updateTenantMembership(membershipId: string, data: unknown): Promise<unknown>;
  deleteTenantMembership(membershipId: string): Promise<void>;
  clearUserActiveTenantIfMatches(userId: string, tenantId: string): Promise<void>;

  tenantExistsById(tenantId: string): Promise<boolean>;
  listTenantSummariesForSuperAdmin(): Promise<TenantSummaryRow[]>;
  createTenant(params: CreateTenantInput): Promise<CreateTenantResult>;
  updateTenantActive(tenantId: string, isActive: boolean): Promise<TenantSummaryRow | null>;
  listActiveTenantMembershipRows(tenantId: string): Promise<TenantMembershipListRow[]>;

  findTenantWhatsAppById(tenantId: string): Promise<TenantWhatsAppRow | null>;
  updateTenantWhatsApp(tenantId: string, patch: TenantWhatsAppPatchInput): Promise<TenantWhatsAppRow>;

  findTenantNotificationPrefsById(tenantId: string): Promise<TenantNotificationPrefsRow | null>;
  updateTenantNotificationPrefs(
    tenantId: string,
    data: Partial<TenantNotificationPrefsRow>,
  ): Promise<TenantNotificationPrefsRow>;

  findTenantClinicProfileById(tenantId: string): Promise<TenantClinicProfileRow | null>;
  updateTenantClinicProfile(
    tenantId: string,
    data: TenantClinicProfilePatchInput,
  ): Promise<TenantClinicProfileRow>;

  /** Troca de tenant ativo: só `id` + `isActive` (evita vazar modelo completo). */
  findTenantSwitchStatus(tenantId: string): Promise<{ id: string; isActive: boolean } | null>;

  /** Escopo RBAC de visibilidade de clientes (membership no tenant). */
  findMembershipScopeForClientVisibility(
    userId: string,
    tenantId: string,
  ): Promise<{
    role: string;
    restrictedToAssignedOnly: boolean;
    linkedOpmeSupplierId: string | null;
  } | null>;

  listMembershipUserIds(tenantId: string): Promise<string[]>;

  listTenantAdminUserIds(tenantId: string): Promise<string[]>;

  isUserMemberOfTenant(tenantId: string, userId: string): Promise<boolean>;

  /** Nome + slug (portal, magic link, convites). */
  findTenantNameAndSlugById(tenantId: string): Promise<{ name: string; slug: string } | null>;

  /** Webhook WhatsApp Meta: resolve tenant pelo `phone_number_id`. */
  findTenantIdByWhatsappPhoneNumberId(phoneNumberId: string): Promise<{ id: string } | null>;
}

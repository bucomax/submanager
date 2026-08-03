import type { ApiPagination } from "@/lib/api/pagination";

export type TenantMemberPickerRow = {
  userId: string;
  name: string | null;
  email: string;
};

export type TenantMembersListResponseData = {
  members: TenantMemberPickerRow[];
};

export type OpmeSupplierDto = {
  id: string;
  name: string;
  active: boolean;
  activePatientsCount: number;
};

export type ListOpmeSuppliersQueryParams = {
  page?: number;
  limit?: number;
  q?: string;
  includeInactive?: boolean;
};

export type OpmeSuppliersListResponseData = {
  data: OpmeSupplierDto[];
  pagination: ApiPagination;
};

export type CreateOpmeSupplierResponseData = {
  supplier: OpmeSupplierDto;
};

export type TenantClinicSettingsDto = {
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

export type GetTenantClinicSettingsResponseData = {
  tenant: TenantClinicSettingsDto;
};

export type UpdateTenantClinicSettingsRequestBody = {
  name?: string;
  taxId?: string | null;
  phone?: string | null;
  addressLine?: string | null;
  city?: string | null;
  postalCode?: string | null;
  affiliatedHospitals?: string | null;
};

export type UpdateTenantClinicSettingsResponseData = {
  tenant: TenantClinicSettingsDto;
};

export type TenantNotificationSettingsDto = {
  notifyCriticalAlerts: boolean;
  notifySurgeryReminders: boolean;
  notifyNewPatients: boolean;
  notifyWeeklyReport: boolean;
  notifyDocumentDelivery: boolean;
};

export type GetTenantNotificationSettingsResponseData = {
  notifications: TenantNotificationSettingsDto;
};

export type UpdateTenantNotificationSettingsRequestBody = Partial<TenantNotificationSettingsDto>;

export type UpdateTenantNotificationSettingsResponseData = {
  notifications: TenantNotificationSettingsDto;
};

// ---------------------------------------------------------------------------
// WhatsApp Business API Settings
// ---------------------------------------------------------------------------

export type WhatsAppSettingsDto = {
  whatsappEnabled: boolean;
  whatsappPhoneNumberId: string | null;
  whatsappBusinessAccountId: string | null;
  /** Access token is never exposed — only a boolean flag. */
  hasAccessToken: boolean;
  whatsappVerifiedAt: string | null;
};

export type GetWhatsAppSettingsResponseData = {
  whatsapp: WhatsAppSettingsDto;
};

export type UpdateWhatsAppSettingsRequestBody = {
  whatsappEnabled?: boolean;
  whatsappPhoneNumberId?: string | null;
  whatsappBusinessAccountId?: string | null;
  /** Plaintext on write — encrypted at storage layer. */
  whatsappAccessToken?: string | null;
};

export type UpdateWhatsAppSettingsResponseData = {
  whatsapp: WhatsAppSettingsDto;
};

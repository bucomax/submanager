export type CreateAdminTenantRequestBody = {
  name: string;
  slug: string;
  taxId?: string | null;
  phone?: string | null;
  addressLine?: string | null;
  city?: string | null;
  postalCode?: string | null;
  admin?: {
    email: string;
    name?: string | null;
  } | null;
};

export type AdminTenantDto = {
  id: string;
  name: string;
  slug: string;
};

export type AdminTenantListItemDto = AdminTenantDto & {
  isActive: boolean;
};

export type ListAdminTenantsResponseData = {
  tenants: AdminTenantListItemDto[];
};

export type PatchAdminTenantRequestBody = {
  isActive: boolean;
};

export type PatchAdminTenantResponseData = {
  tenant: AdminTenantListItemDto;
};

export type CreateAdminTenantResponseData = {
  tenant: AdminTenantDto & {
    taxId: string | null;
    phone: string | null;
    addressLine: string | null;
    city: string | null;
    postalCode: string | null;
  };
  adminCreated: boolean;
  adminEmail: string | null;
  /** userId do admin convidado; null quando nenhum admin foi informado. */
  adminUserId: string | null;
  emailDispatched: boolean;
  emailError?: string | null;
};

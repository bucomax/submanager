import type {
  AppCategory,
  AppRenderMode,
  AppPricingModel,
  AppBillingInterval,
  TenantAppStatus,
  SubscriptionStatus,
} from "@prisma/client";

// Re-export enums for convenience
export type {
  AppCategory,
  AppRenderMode,
  AppPricingModel,
  AppBillingInterval,
  TenantAppStatus,
  SubscriptionStatus,
};

// ---------------------------------------------------------------------------
// Screenshots
// ---------------------------------------------------------------------------

export type AppScreenshotDto = {
  id: string;
  imageUrl: string;
  caption: Record<string, string> | null;
  sortOrder: number;
};

// ---------------------------------------------------------------------------
// App (catálogo)
// ---------------------------------------------------------------------------

export type AppDto = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  iconUrl: string | null;
  accentColor: string | null;
  developerName: string | null;
  developerUrl: string | null;
  category: AppCategory;
  renderMode: AppRenderMode;
  iframeBaseUrl: string | null;
  internalRoute: string | null;
  requiresConfig: boolean;
  configSchema: AppConfigField[] | null;
  isPublished: boolean;
  isFeatured: boolean;
  sortOrder: number;
  /** Sanitizado no servidor: chaves sensíveis (ex.: `webhookSecret`) nunca são devolvidas. */
  metadata: Record<string, unknown> | null;
  screenshots: AppScreenshotDto[];
  pricingModel: AppPricingModel;
  priceInCents: number | null;
  priceCurrency: string;
  billingInterval: AppBillingInterval;
  trialDays: number;
};

/** App servido a rotas de tenant: nunca inclui `metadata` (configuração interna/segredos da plataforma). */
export type TenantAppCatalogDto = Omit<AppDto, "metadata">;

/** Card resumido para grid do catálogo */
export type AppCatalogCardDto = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  iconUrl: string | null;
  accentColor: string | null;
  developerName: string | null;
  category: AppCategory;
  isFeatured: boolean;
  pricingModel: AppPricingModel;
  priceInCents: number | null;
  priceCurrency: string;
  billingInterval: AppBillingInterval;
  trialDays: number;
  tenantStatus: TenantAppStatus | null;
  subscriptionStatus: SubscriptionStatus | null;
};

// ---------------------------------------------------------------------------
// TenantApp
// ---------------------------------------------------------------------------

export type TenantAppDto = {
  id: string;
  appId: string;
  status: TenantAppStatus;
  activatedAt: string | null;
  deactivatedAt: string | null;
  app: TenantAppCatalogDto;
  configSummary: Record<string, string> | null;
  subscriptionStatus: SubscriptionStatus;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
};

/** Para a sidebar — mínimo necessário */
export type ActiveAppDto = {
  slug: string;
  name: string;
  iconUrl: string | null;
  accentColor: string | null;
  renderMode: AppRenderMode;
  internalRoute: string | null;
};

// ---------------------------------------------------------------------------
// Config schema (form dinâmico)
// ---------------------------------------------------------------------------

export type AppConfigFieldType =
  | "text"
  | "secret"
  | "url"
  | "email"
  | "number"
  | "boolean"
  | "select"
  | "textarea";

export type AppConfigField = {
  key: string;
  label: Record<string, string>;
  type: AppConfigFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: Record<string, string>;
  options?: string[];
  default?: string | number | boolean;
};

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export type CreateAppRequestBody = {
  name: string;
  slug?: string;
  tagline?: string;
  description?: string;
  category: AppCategory;
  renderMode: AppRenderMode;
  accentColor?: string;
  developerName?: string;
  developerUrl?: string;
  iframeBaseUrl?: string;
  internalRoute?: string;
  requiresConfig?: boolean;
  configSchema?: AppConfigField[];
  isFeatured?: boolean;
  sortOrder?: number;
  pricingModel?: AppPricingModel;
  priceInCents?: number;
  priceCurrency?: string;
  billingInterval?: AppBillingInterval;
  trialDays?: number;
  metadata?: Record<string, unknown>;
};

export type UpdateAppRequestBody = Partial<CreateAppRequestBody>;

export type PublishAppRequestBody = {
  isPublished: boolean;
};

export type ActivateAppRequestBody = {
  config?: Record<string, unknown>;
};

export type ReorderScreenshotsRequestBody = {
  order: string[];
};

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export type AppCatalogResponseData = {
  featured: AppCatalogCardDto[];
  byCategory: Partial<Record<AppCategory, AppCatalogCardDto[]>>;
};

export type AppDetailResponseData = TenantAppCatalogDto & {
  tenantApp: TenantAppDto | null;
};

export type AdminAppsListResponseData = {
  apps: AppDto[];
};

export type AdminAppDetailResponseData = {
  app: AppDto;
};

export type TenantActiveAppsResponseData = {
  apps: ActiveAppDto[];
};

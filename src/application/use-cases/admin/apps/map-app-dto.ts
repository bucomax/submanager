import type { App, AppScreenshot, FileAsset } from "@prisma/client";
import type { AppDto, AppScreenshotDto, AppConfigField, TenantAppCatalogDto } from "@/types/api/apps-v1";

type AppWithRelations = App & {
  iconFile: FileAsset | null;
  screenshots: (AppScreenshot & { file: FileAsset })[];
};

/** Chaves de `App.metadata` que carregam segredo de integração (ex.: `webhookSecret`) e nunca saem pela API. */
const SENSITIVE_METADATA_KEY = /secret|token|password|passwd|api[-_]?key|private[-_]?key|credential|signature/i;

function redactSensitiveKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitiveKeys);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_METADATA_KEY.test(key))
      .map(([key, nested]) => [key, redactSensitiveKeys(nested)]),
  );
}

/**
 * `App.metadata` sem chaves sensíveis. Ponto único de sanitização: o segredo do webhook
 * (`metadata.webhookSecret`) é lido só pelo servidor, nunca devolvido em DTO.
 */
export function sanitizeAppMetadata(metadata: unknown): Record<string, unknown> | null {
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return redactSensitiveKeys(metadata) as Record<string, unknown>;
}

/** DTO de administração (`super_admin`): `metadata` sanitizado. */
export function mapAppToDto(app: AppWithRelations): AppDto {
  return { ...mapAppToTenantDto(app), metadata: sanitizeAppMetadata(app.metadata) };
}

/** DTO para rotas de tenant: sem `metadata` (segredos de integração e configuração interna da plataforma). */
export function mapAppToTenantDto(app: AppWithRelations): TenantAppCatalogDto {
  return {
    id: app.id,
    slug: app.slug,
    name: app.name,
    tagline: app.tagline,
    description: app.description,
    iconUrl: app.iconFile?.r2Key ?? null,
    accentColor: app.accentColor,
    developerName: app.developerName,
    developerUrl: app.developerUrl,
    category: app.category,
    renderMode: app.renderMode,
    iframeBaseUrl: app.iframeBaseUrl,
    internalRoute: app.internalRoute,
    requiresConfig: app.requiresConfig,
    configSchema: app.configSchema as AppConfigField[] | null,
    isPublished: app.isPublished,
    isFeatured: app.isFeatured,
    sortOrder: app.sortOrder,
    screenshots: app.screenshots.map(mapScreenshotToDto),
    pricingModel: app.pricingModel,
    priceInCents: app.priceInCents,
    priceCurrency: app.priceCurrency,
    billingInterval: app.billingInterval,
    trialDays: app.trialDays,
  };
}

function mapScreenshotToDto(ss: AppScreenshot & { file: FileAsset }): AppScreenshotDto {
  return {
    id: ss.id,
    imageUrl: ss.file.r2Key,
    caption: ss.caption as Record<string, string> | null,
    sortOrder: ss.sortOrder,
  };
}

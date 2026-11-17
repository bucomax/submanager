import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums (alinhados ao Prisma)
// ---------------------------------------------------------------------------

const appCategoryEnum = z.enum([
  "communication",
  "ai",
  "scheduling",
  "clinical",
  "financial",
  "integration",
]);

const appRenderModeEnum = z.enum(["iframe", "internal", "external_link"]);

const appPricingModelEnum = z.enum(["free", "flat", "per_seat", "usage_based"]);

const appBillingIntervalEnum = z.enum(["monthly", "yearly"]);

// ---------------------------------------------------------------------------
// Config schema field
// ---------------------------------------------------------------------------

const appConfigFieldSchema = z.object({
  key: z.string().min(1).max(64),
  label: z.record(z.string(), z.string()),
  type: z.enum([
    "text",
    "secret",
    "url",
    "email",
    "number",
    "boolean",
    "select",
    "textarea",
  ]),
  required: z.boolean(),
  placeholder: z.string().max(256).optional(),
  helpText: z.record(z.string(), z.string()).optional(),
  options: z.array(z.string()).optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

// ---------------------------------------------------------------------------
// Slug
// ---------------------------------------------------------------------------

const slugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug deve conter apenas letras minúsculas, números e hífens.");

// ---------------------------------------------------------------------------
// Create App (super_admin)
// ---------------------------------------------------------------------------

export const createAppBodySchema = z
  .object({
    name: z.string().min(2).max(128),
    slug: slugSchema.optional(),
    tagline: z.string().max(256).optional(),
    description: z.string().max(10000).optional(),
    category: appCategoryEnum,
    renderMode: appRenderModeEnum,
    accentColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Cor deve estar no formato hex (#RRGGBB).")
      .optional(),
    developerName: z.string().max(128).optional(),
    developerUrl: z.string().url().max(512).optional(),
    iframeBaseUrl: z.string().url().max(2048).optional(),
    internalRoute: z.string().max(256).optional(),
    requiresConfig: z.boolean().optional(),
    configSchema: z.array(appConfigFieldSchema).max(20).optional(),
    isFeatured: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
    pricingModel: appPricingModelEnum.optional(),
    priceInCents: z.number().int().min(0).optional(),
    priceCurrency: z.string().length(3).optional(),
    billingInterval: appBillingIntervalEnum.optional(),
    trialDays: z.number().int().min(0).max(365).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (data) => {
      if (data.renderMode === "iframe" && !data.iframeBaseUrl) return false;
      return true;
    },
    { message: "iframeBaseUrl é obrigatório quando renderMode é iframe.", path: ["iframeBaseUrl"] },
  )
  .refine(
    (data) => {
      if (data.renderMode === "internal" && !data.internalRoute) return false;
      return true;
    },
    { message: "internalRoute é obrigatório quando renderMode é internal.", path: ["internalRoute"] },
  );

// ---------------------------------------------------------------------------
// Update App (super_admin)
// ---------------------------------------------------------------------------

export const updateAppBodySchema = z
  .object({
    name: z.string().min(2).max(128).optional(),
    slug: slugSchema.optional(),
    tagline: z.string().max(256).nullable().optional(),
    description: z.string().max(10000).nullable().optional(),
    category: appCategoryEnum.optional(),
    renderMode: appRenderModeEnum.optional(),
    accentColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Cor deve estar no formato hex (#RRGGBB).")
      .nullable()
      .optional(),
    developerName: z.string().max(128).nullable().optional(),
    developerUrl: z.string().url().max(512).nullable().optional(),
    iframeBaseUrl: z.string().url().max(2048).nullable().optional(),
    internalRoute: z.string().max(256).nullable().optional(),
    requiresConfig: z.boolean().optional(),
    configSchema: z.array(appConfigFieldSchema).max(20).nullable().optional(),
    isFeatured: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
    pricingModel: appPricingModelEnum.optional(),
    priceInCents: z.number().int().min(0).nullable().optional(),
    priceCurrency: z.string().length(3).optional(),
    billingInterval: appBillingIntervalEnum.optional(),
    trialDays: z.number().int().min(0).max(365).optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  });

// ---------------------------------------------------------------------------
// Publish / Unpublish
// ---------------------------------------------------------------------------

export const publishAppBodySchema = z.object({
  isPublished: z.boolean(),
});

// ---------------------------------------------------------------------------
// Activate app (tenant_admin)
// ---------------------------------------------------------------------------

export const activateAppBodySchema = z.object({
  config: z.record(z.string(), z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Update app config (tenant_admin)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Reorder screenshots
// ---------------------------------------------------------------------------

export const reorderScreenshotsBodySchema = z.object({
  order: z.array(z.string().min(1)).min(1).max(8),
});

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------


import { z } from "zod";
import type { AppDto, CreateAppRequestBody } from "@/types/api/apps-v1";

// Form schema (subset for the wizard — backend does full validation)

export const wizardSchema = z
  .object({
    // Step 1 — identity
    name: z.string().min(2).max(128),
    slug: z.string().max(64).optional().or(z.literal("")),
    tagline: z.string().max(256).optional().or(z.literal("")),
    description: z.string().max(10000).optional().or(z.literal("")),
    category: z.enum([
      "communication",
      "ai",
      "scheduling",
      "clinical",
      "financial",
      "integration",
    ]),
    accentColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional()
      .or(z.literal("")),
    developerName: z.string().max(128).optional().or(z.literal("")),
    developerUrl: z.string().max(512).optional().or(z.literal("")),

    // Step 2 — config
    renderMode: z.enum(["iframe", "internal", "external_link"]),
    iframeBaseUrl: z.string().max(2048).optional().or(z.literal("")),
    internalRoute: z.string().max(256).optional().or(z.literal("")),
    requiresConfig: z.boolean(),
    isFeatured: z.boolean(),
    sortOrder: z.coerce.number<number>().int().min(0).max(9999),

    // Step 2 — pricing
    pricingModel: z.enum(["free", "flat", "per_seat", "usage_based"]),
    priceInCents: z.coerce.number<number>().int().min(0).optional(),
    billingInterval: z.enum(["monthly", "yearly"]),
    trialDays: z.coerce.number<number>().int().min(0).max(365),
  })
  .refine(
    (d) => !(d.renderMode === "iframe" && !d.iframeBaseUrl),
    { message: "URL obrigatória para modo iframe.", path: ["iframeBaseUrl"] },
  )
  .refine(
    (d) => !(d.renderMode === "internal" && !d.internalRoute),
    { message: "Rota obrigatória para modo interno.", path: ["internalRoute"] },
  );

export type WizardValues = z.infer<typeof wizardSchema>;

export type WizardStep = 1 | 2 | 3;

// Step 1 field names for partial validation
export const STEP1_FIELDS: (keyof WizardValues)[] = [
  "name",
  "category",
  "tagline",
  "description",
  "accentColor",
  "developerName",
  "developerUrl",
];

export const STEP2_FIELDS: (keyof WizardValues)[] = [
  "renderMode",
  "iframeBaseUrl",
  "internalRoute",
  "requiresConfig",
  "isFeatured",
  "sortOrder",
  "pricingModel",
  "priceInCents",
  "billingInterval",
  "trialDays",
];

export function buildWizardDefaults(editApp: AppDto | null | undefined): WizardValues {
  return {
    name: editApp?.name ?? "",
    slug: editApp?.slug ?? "",
    tagline: editApp?.tagline ?? "",
    description: editApp?.description ?? "",
    category: editApp?.category ?? "integration",
    accentColor: editApp?.accentColor ?? "",
    developerName: editApp?.developerName ?? "",
    developerUrl: editApp?.developerUrl ?? "",
    renderMode: editApp?.renderMode ?? "iframe",
    iframeBaseUrl: editApp?.iframeBaseUrl ?? "",
    internalRoute: editApp?.internalRoute ?? "",
    requiresConfig: editApp?.requiresConfig ?? false,
    isFeatured: editApp?.isFeatured ?? false,
    sortOrder: editApp?.sortOrder ?? 0,
    pricingModel: editApp?.pricingModel ?? "free",
    priceInCents: editApp?.priceInCents ?? 0,
    billingInterval: editApp?.billingInterval ?? "monthly",
    trialDays: editApp?.trialDays ?? 0,
  };
}

export function buildAppRequestBody(v: WizardValues): CreateAppRequestBody {
  return {
    name: v.name,
    category: v.category,
    renderMode: v.renderMode,
    ...(v.slug ? { slug: v.slug } : {}),
    ...(v.tagline ? { tagline: v.tagline } : {}),
    ...(v.description ? { description: v.description } : {}),
    ...(v.accentColor ? { accentColor: v.accentColor } : {}),
    ...(v.developerName ? { developerName: v.developerName } : {}),
    ...(v.developerUrl ? { developerUrl: v.developerUrl } : {}),
    ...(v.iframeBaseUrl ? { iframeBaseUrl: v.iframeBaseUrl } : {}),
    ...(v.internalRoute ? { internalRoute: v.internalRoute } : {}),
    requiresConfig: v.requiresConfig,
    isFeatured: v.isFeatured,
    sortOrder: v.sortOrder,
    pricingModel: v.pricingModel,
    ...(v.pricingModel !== "free" ? { priceInCents: v.priceInCents } : {}),
    billingInterval: v.billingInterval,
    trialDays: v.trialDays,
  };
}

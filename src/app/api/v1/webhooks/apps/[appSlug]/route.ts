import { logger } from "@/lib/observability/logger";
import { formatZodIssues } from "@/lib/api/zod-error";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { prisma } from "@/infrastructure/database/prisma";
import { appPrismaRepository } from "@/infrastructure/repositories/app.repository";
import { checkWebhookTimestamp } from "@/lib/utils/webhook-timestamp";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ appSlug: string }> };

// ---------------------------------------------------------------------------
// Webhook body schema
// ---------------------------------------------------------------------------

const webhookBodySchema = z.object({
  /** Unique event ID for idempotency */
  eventId: z.string().min(1).max(256),
  /** Event type (app-defined, e.g. "chat.completed", "appointment.confirmed") */
  eventType: z.string().min(1).max(128),
  /** Tenant ID the event belongs to */
  tenantId: z.string().min(1),
  /** Event payload (app-specific) */
  data: z.record(z.string(), z.unknown()).optional(),
  /** ISO timestamp of the event */
  timestamp: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

function verifySignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  try {
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    const sig = signature.replace(/^sha256=/, "");
    if (sig.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/webhooks/apps/:appSlug
 *
 * Receives webhook events from external apps.
 * Validates HMAC-SHA256 signature via X-Webhook-Signature header.
 * The webhook secret is stored in App.metadata.webhookSecret (server-only; never serialized in DTOs).
 *
 * Replay protection: `timestamp` (when sent) must be within ±5 min, and each
 * `eventId` is processed once per app/tenant (duplicates are acknowledged with 200).
 *
 * Responds 200 immediately; heavy processing should be queued.
 */
export async function POST(request: Request, context: RouteContext) {
  const { appSlug } = await context.params;

  // Find app by slug
  const app = await appPrismaRepository.findBySlug(appSlug);
  if (!app) {
    return jsonError("NOT_FOUND", "App not found.", 404);
  }

  // Get webhook secret from metadata
  const metadata = app.metadata as Record<string, unknown> | null;
  const webhookSecret = metadata?.webhookSecret;
  if (!webhookSecret || typeof webhookSecret !== "string") {
    return jsonError("NOT_CONFIGURED", "Webhook not configured for this app.", 422);
  }

  // Read raw body for signature verification
  const rawBody = await request.text();

  // Verify signature
  const signature = request.headers.get("x-webhook-signature") ?? "";
  if (!signature || !verifySignature(rawBody, signature, webhookSecret)) {
    return jsonError("UNAUTHORIZED", "Invalid webhook signature.", 401);
  }

  // Parse body
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonError("INVALID_JSON", "Invalid JSON.", 400);
  }

  const parsed = webhookBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      formatZodIssues(parsed.error),
      422,
    );
  }

  const { eventId, eventType, tenantId, timestamp } = parsed.data;

  // Replay: the timestamp is covered by the HMAC, so a stale one means a captured request being resent.
  const timestampCheck = checkWebhookTimestamp(timestamp);
  if (timestampCheck === "invalid") {
    return jsonError("VALIDATION_ERROR", "Invalid timestamp.", 422);
  }
  if (timestampCheck === "stale") {
    return jsonError("TIMESTAMP_OUT_OF_RANGE", "Webhook timestamp outside the accepted window.", 400);
  }

  // Verify tenant has this app active
  const tenantApp = await appPrismaRepository.findTenantApp(tenantId, app.id);
  if (!tenantApp || tenantApp.status !== "active") {
    return jsonError("FORBIDDEN", "App not active for this tenant.", 403);
  }

  // Idempotency: count 0 = this event was already accepted; acknowledge without reprocessing.
  const claimed = await prisma.dispatchKey.createMany({
    data: [{ key: `app-webhook:${app.id}:${tenantId}:${eventId}` }],
    skipDuplicates: true,
  });
  if (claimed.count === 0) {
    logger.info("[webhook] duplicate event ignored", { appSlug, tenantId, eventId });
    return jsonSuccess({ received: true, duplicate: true });
  }

  // TODO: Route event to specific handler based on eventType
  // TODO: Dispatch to BullMQ queue for heavy processing
  // For now, just acknowledge receipt and log.

  logger.info("[webhook] received", { appSlug, tenantId, eventType, eventId, timestamp: timestamp ?? "now" });

  return jsonSuccess({ received: true });
}

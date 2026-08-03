import { createHmac } from "node:crypto";

import { whatsappWebhookPayloadSchema } from "@/lib/validators/whatsapp-webhook";
import type { WhatsappWebhookPayload } from "@/types/api/whatsapp-webhook-v1";
import { processWhatsappWebhookPayload } from "@/application/use-cases/whatsapp/process-whatsapp-webhook-payload";
import { timingSafeEqualStrings } from "@/lib/utils/timing-safe-compare";

export const dynamic = "force-dynamic";

/**
 * Callback único da plataforma (modelo Tech Provider): um app Meta, vários WABAs de clínicas.
 * Quem assina o payload é a Meta com o App Secret **do app**, por isso `WHATSAPP_APP_SECRET`
 * e `WHATSAPP_WEBHOOK_VERIFY_TOKEN` são da plataforma, não do tenant.
 * O tenant é resolvido pelo `phone_number_id` do corpo em `processWhatsappWebhookPayload`.
 */

// ---------------------------------------------------------------------------
// GET — Meta webhook verification (subscribe handshake)
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();

  if (
    mode === "subscribe" &&
    token &&
    challenge &&
    expectedToken &&
    timingSafeEqualStrings(token, expectedToken)
  ) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new Response("Forbidden", { status: 403 });
}

// ---------------------------------------------------------------------------
// Signature verification (HMAC-SHA256, header `x-hub-signature-256`)
// ---------------------------------------------------------------------------

function verifySignature(rawBody: string, signature: string, appSecret: string): boolean {
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return timingSafeEqualStrings(signature.replace(/^sha256=/, ""), expected);
}

// ---------------------------------------------------------------------------
// POST — Inbound status updates and interactive button replies
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
  if (!appSecret) {
    console.error("[whatsapp-webhook] WHATSAPP_APP_SECRET ausente — rejeitando.");
    return new Response("Webhook not configured", { status: 503 });
  }

  const signature = request.headers.get("x-hub-signature-256");
  if (!signature) {
    console.warn("[whatsapp-webhook] Missing signature — rejecting.");
    return new Response("Missing signature", { status: 401 });
  }

  const rawBody = await request.text();

  if (!verifySignature(rawBody, signature, appSecret)) {
    console.warn("[whatsapp-webhook] Invalid signature — rejecting.");
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: WhatsappWebhookPayload;
  try {
    const parsedPayload = whatsappWebhookPayloadSchema.safeParse(JSON.parse(rawBody));
    if (!parsedPayload.success) {
      return new Response("OK", { status: 200 });
    }
    payload = parsedPayload.data;
  } catch {
    return new Response("OK", { status: 200 });
  }

  processWhatsappWebhookPayload(payload).catch((err) =>
    console.error("[whatsapp-webhook] processing error:", err),
  );

  return new Response("OK", { status: 200 });
}

import { logger } from "@/lib/observability/logger";
import { Webhook } from "svix";

import { processResendWebhookPayload } from "@/application/use-cases/email/process-resend-webhook-payload";

export const dynamic = "force-dynamic";

/**
 * Resend usa Svix: corpo em JSON bruto + headers `svix-id`, `svix-timestamp`, `svix-signature`.
 * `RESEND_WEBHOOK_SECRET` = signing secret exibido no painel (webhook → Signing Secret).
 */
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return new Response("Webhook not configured", { status: 503 });
  }

  const rawBody = await request.text();
  const id = request.headers.get("svix-id");
  const ts = request.headers.get("svix-timestamp");
  const sig = request.headers.get("svix-signature");
  if (!id || !ts || !sig) {
    return new Response("Missing svix headers", { status: 400 });
  }

  let payload: unknown;
  try {
    const wh = new Webhook(secret);
    payload = wh.verify(rawBody, {
      "svix-id": id,
      "svix-timestamp": ts,
      "svix-signature": sig,
    });
  } catch (err) {
    logger.warn("[resend-webhook] Invalid signature", { err });
    return new Response("Invalid signature", { status: 401 });
  }

  if (typeof payload === "object" && payload !== null) {
    await processResendWebhookPayload(payload);
  }

  return new Response("OK", { status: 200 });
}

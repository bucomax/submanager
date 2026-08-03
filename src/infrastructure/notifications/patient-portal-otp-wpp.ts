/**
 * Opcional: envio do código OTP por WhatsApp (ou outro canal) via webhook configurável.
 * Body JSON: `{ "phone": "+5511...", "text": "..." }` — ajuste o receptor conforme o serviço SubManager.
 */
export async function notifyPatientPortalOtpByWebhook(params: {
  phone: string;
  text: string;
}): Promise<void> {
  const url = process.env.PATIENT_PORTAL_OTP_NOTIFY_URL?.trim();
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: params.phone,
        text: params.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.error("[patient-portal] OTP notify webhook failed:", e);
  }
}

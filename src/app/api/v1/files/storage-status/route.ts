import { withSessionRoute } from "@/lib/api/route-handler";
import { isGcsConfigured } from "@/infrastructure/storage/gcs-storage";
import { jsonSuccess } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/**
 * Indica se upload direto ao GCS está disponível (credenciais + bucket).
 * Foto de perfil pode usar referência `gcs:key` sem `GCS_PUBLIC_BASE_URL`.
 */
export const GET = withSessionRoute(async () => {
  return jsonSuccess({ available: isGcsConfigured() });
});

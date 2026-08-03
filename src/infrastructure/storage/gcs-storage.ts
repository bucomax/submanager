import { createHash, randomUUID } from "crypto";
import { Storage } from "@google-cloud/storage";

import { UPLOAD_URL_TTL_SECONDS } from "@/lib/constants/file-upload";
import { BUCOMAX_GCS_PROJECT_ID } from "@/lib/constants/gcs";

type GcpServiceAccountJson = {
  type?: string;
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

let storageClient: Storage | null = null;

function parseServiceAccountJson(): GcpServiceAccountJson | null {
  const raw = process.env.GCS_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GcpServiceAccountJson;
  } catch {
    return null;
  }
}

function bucketNameOrThrow(): string {
  const name = process.env.GCS_BUCKET_NAME?.trim();
  if (!name) {
    throw new Error("GCS_BUCKET_NAME is not set.");
  }
  return name;
}

function assertBucomaxGcsProject(projectId: string): void {
  if (projectId !== BUCOMAX_GCS_PROJECT_ID) {
    throw new Error(
      `GCS: este app só usa o projeto GCP "${BUCOMAX_GCS_PROJECT_ID}" para o bucket; recebido "${projectId}". Ajuste a service account ou GCS_PROJECT_ID.`,
    );
  }
}

/** Projeto efetivo para Storage (JSON da SA ou GCS_PROJECT_ID), sem criar o cliente. */
function resolveEffectiveGcsProjectId(): string | undefined {
  const sa = parseServiceAccountJson();
  if (sa?.client_email && sa.private_key) {
    const fromJson = typeof sa.project_id === "string" && sa.project_id ? sa.project_id.trim() : "";
    return fromJson || process.env.GCS_PROJECT_ID?.trim() || undefined;
  }
  return process.env.GCS_PROJECT_ID?.trim() || undefined;
}

function getStorage(): Storage {
  if (storageClient) {
    return storageClient;
  }
  const sa = parseServiceAccountJson();
  if (sa?.client_email && sa.private_key) {
    const projectId =
      typeof sa.project_id === "string" && sa.project_id
        ? sa.project_id.trim()
        : process.env.GCS_PROJECT_ID?.trim();
    if (!projectId) {
      throw new Error("GCS: inclua project_id no JSON da service account ou defina GCS_PROJECT_ID.");
    }
    assertBucomaxGcsProject(projectId);
    const privateKey = sa.private_key.replace(/\\n/g, "\n");
    storageClient = new Storage({
      projectId,
      credentials: {
        client_email: sa.client_email,
        private_key: privateKey,
      },
    });
  } else {
    const projectId = process.env.GCS_PROJECT_ID?.trim();
    if (!projectId) {
      throw new Error(
        `GCS: defina GCS_PROJECT_ID=${BUCOMAX_GCS_PROJECT_ID} ao usar GOOGLE_APPLICATION_CREDENTIALS ou ADC.`,
      );
    }
    assertBucomaxGcsProject(projectId);
    storageClient = new Storage({ projectId });
  }
  return storageClient;
}

/** Bucket + credenciais mínimas para presign e deletes. */
export function isGcsConfigured(): boolean {
  if (!process.env.GCS_BUCKET_NAME?.trim()) {
    return false;
  }
  const sa = parseServiceAccountJson();
  if (sa) {
    if (!sa.client_email || !sa.private_key) {
      return false;
    }
    const projectId = resolveEffectiveGcsProjectId();
    return projectId === BUCOMAX_GCS_PROJECT_ID;
  }
  const projectId = resolveEffectiveGcsProjectId();
  if (!projectId || projectId !== BUCOMAX_GCS_PROJECT_ID) {
    return false;
  }
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
      process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
      process.env.GCLOUD_PROJECT?.trim(),
  );
}

/**
 * Categorias de objeto no bucket. Cada uma mapeia para um segmento no prefixo
 * e pode ter lifecycle/política diferente no GCS.
 *
 * - `uploads`     — documentos do paciente ou biblioteca do tenant (default)
 * - `dispatches`  — snapshots enviados via WhatsApp (StageTransition)
 * - `exports`     — relatórios gerados (PDFs, CSVs) — TTL curto
 * - `avatars`     — fotos de perfil de membros/tenant
 */
export type ObjectCategory = "uploads" | "dispatches" | "exports" | "avatars";

export type BuildUploadObjectKeyInput = {
  tenantId: string;
  originalFileName: string;
  /** Paciente (`Client`). Ausente = biblioteca do tenant (modelos de jornada, avatar, etc.). */
  clientId?: string | null;
  /** Categoria do objeto — default `uploads`. */
  category?: ObjectCategory;
};

/**
 * Layout no bucket (prefixo único por tenant):
 *
 * ```
 * tenants/{tenantId}/
 *   clients/{clientId}/
 *     uploads/          → documentos do paciente (exames, fotos, termos)
 *     dispatches/       → snapshots enviados via WhatsApp (StageTransition)
 *   library/
 *     uploads/          → modelos, templates de documentos do tenant
 *   avatars/            → fotos de perfil de membros do tenant
 *   exports/            → relatórios gerados (PDFs, CSVs) — TTL curto
 * ```
 *
 * Usamos **clientId** (e não `patientPathwayId`) porque `FileAsset` referencia o paciente; a mesma pessoa pode ter
 * várias jornadas e os documentos continuam sendo dela. Etapas apontam para `FileAsset` por id.
 */
export function buildUploadObjectKey(input: BuildUploadObjectKeyInput): string {
  const safe = input.originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "file";
  const id = randomUUID();
  const base = `tenants/${input.tenantId}`;
  const category = input.category ?? "uploads";
  const cid = input.clientId?.trim();
  if (cid) {
    return `${base}/clients/${cid}/${category}/${id}-${safe}`;
  }
  if (category === "avatars" || category === "exports") {
    return `${base}/${category}/${id}-${safe}`;
  }
  return `${base}/library/${category}/${id}-${safe}`;
}

/** Aceita todos os prefixos válidos do tenant (clients, library, avatars, exports e legado uploads). */
export function keyBelongsToTenant(key: string, tenantId: string): boolean {
  const prefix = `tenants/${tenantId}/`;
  return (
    key.startsWith(`${prefix}clients/`) ||
    key.startsWith(`${prefix}library/`) ||
    key.startsWith(`${prefix}avatars/`) ||
    key.startsWith(`${prefix}exports/`) ||
    key.startsWith(`${prefix}uploads/`)
  );
}

export function keyBelongsToTenantClient(key: string, tenantId: string, clientId: string): boolean {
  return key.startsWith(`tenants/${tenantId}/clients/${clientId}/`);
}

/**
 * Valida a chave em relação ao registro: com `clientId` exige pasta desse paciente;
 * sem `clientId` exige `library/`, `avatars/`, `exports/` ou legado `uploads/`.
 */
export function keyMatchesFileRegisterIntent(
  key: string,
  tenantId: string,
  clientId: string | undefined | null,
): boolean {
  if (!keyBelongsToTenant(key, tenantId)) {
    return false;
  }
  const prefix = `tenants/${tenantId}/`;
  if (clientId) {
    return keyBelongsToTenantClient(key, tenantId, clientId);
  }
  return (
    key.startsWith(`${prefix}library/`) ||
    key.startsWith(`${prefix}avatars/`) ||
    key.startsWith(`${prefix}exports/`) ||
    key.startsWith(`${prefix}uploads/`)
  );
}

export async function presignPutObject(key: string, mimeType: string): Promise<string> {
  const bucket = getStorage().bucket(bucketNameOrThrow());
  const file = bucket.file(key);
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + UPLOAD_URL_TTL_SECONDS * 1000,
    contentType: mimeType,
  });
  return url;
}

export async function presignGetObject(key: string, expiresInSeconds = 300): Promise<string> {
  const bucket = getStorage().bucket(bucketNameOrThrow());
  const file = bucket.file(key);
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + expiresInSeconds * 1000,
  });
  return url;
}

export async function deleteObjectFromBucket(key: string): Promise<void> {
  const bucket = getStorage().bucket(bucketNameOrThrow());
  await bucket.file(key).delete();
}

/**
 * Calcula SHA-256 (hex) do objeto já gravado no bucket.
 * Retorna `null` se GCS não estiver configurado, o objeto não existir ou a leitura falhar.
 */
export async function computeSha256HexForGcsObjectKey(key: string): Promise<string | null> {
  if (!isGcsConfigured()) return null;
  try {
    const bucket = getStorage().bucket(bucketNameOrThrow());
    const file = bucket.file(key);
    const [exists] = await file.exists();
    if (!exists) return null;
    const hash = createHash("sha256");
    await new Promise<void>((resolve, reject) => {
      const rs = file.createReadStream();
      rs.on("data", (chunk: Buffer | string) => {
        hash.update(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      });
      rs.on("end", () => resolve());
      rs.on("error", reject);
    });
    return hash.digest("hex");
  } catch {
    return null;
  }
}

/**
 * Lê os primeiros `size` bytes de um objeto no bucket (para validação de magic bytes).
 * Retorna `null` se GCS não estiver configurado ou o objeto não existir.
 */
export async function readFirstBytesFromGcsObject(
  key: string,
  size: number,
): Promise<Uint8Array | null> {
  if (!isGcsConfigured()) return null;
  try {
    const bucket = getStorage().bucket(bucketNameOrThrow());
    const file = bucket.file(key);
    const [exists] = await file.exists();
    if (!exists) return null;

    const chunks: Buffer[] = [];
    let totalRead = 0;

    await new Promise<void>((resolve, reject) => {
      const rs = file.createReadStream({ start: 0, end: size - 1 });
      rs.on("data", (chunk: Buffer | string) => {
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        chunks.push(buf);
        totalRead += buf.length;
        if (totalRead >= size) {
          rs.destroy();
          resolve();
        }
      });
      rs.on("end", () => resolve());
      rs.on("error", reject);
    });

    return new Uint8Array(Buffer.concat(chunks).subarray(0, size));
  } catch {
    return null;
  }
}

/** URL pública estável (ex.: bucket público ou CDN); senão `null` — downloads usam presign. */
export function publicUrlForKey(key: string): string | null {
  const base = process.env.GCS_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/${key}`;
}

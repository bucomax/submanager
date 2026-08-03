import { MAGIC_BYTES_KNOWN_MIME_TYPES } from "@/lib/utils/magic-bytes";

/**
 * Tipos aceitos no upload (presign e registro).
 *
 * Fonte de verdade: os MIME types que `validateMagicBytes` sabe conferir contra
 * a assinatura binária do objeto no bucket. Aceitar algo fora dessa lista
 * significa gravar um arquivo que nunca será validado.
 *
 * Cobre imagem clínica (JPEG, PNG, WEBP, GIF, BMP, TIFF), PDF e Office/ZIP.
 * HEIC e DICOM ficam de fora até existir assinatura correspondente no mapa.
 */
export const ALLOWED_UPLOAD_MIME_TYPES: readonly string[] = MAGIC_BYTES_KNOWN_MIME_TYPES;

const ALLOWED_UPLOAD_MIME_SET = new Set(ALLOWED_UPLOAD_MIME_TYPES);

export function isAllowedUploadMimeType(mimeType: string): boolean {
  return ALLOWED_UPLOAD_MIME_SET.has(mimeType.toLowerCase().trim());
}

/** Teto por arquivo. Exame em PDF/imagem não passa disso; 500 MB era vetor de custo. */
export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;

/** TTL da URL assinada de escrita (presign PUT). Upload começa logo após o presign. */
export const UPLOAD_URL_TTL_SECONDS = 900;

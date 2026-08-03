/**
 * Validação de conteúdo de arquivo por magic bytes (assinatura binária).
 *
 * Funciona tanto no browser (File → ArrayBuffer) quanto no server (Buffer do GCS).
 * Não depende de extensão nem do `Content-Type` declarado pelo cliente.
 */

type MagicSignature = {
  /** Bytes esperados (posição relativa ao offset). */
  bytes: number[];
  /** Offset inicial no arquivo (default 0). */
  offset?: number;
};

type MimeRule = {
  signatures: MagicSignature[];
};

/**
 * Mapa MIME → assinaturas válidas.
 * Cobre os tipos mais comuns em contexto clínico (imagens, PDF, Office).
 */
const MAGIC_BYTES_MAP: Record<string, MimeRule> = {
  // ---------- Imagens ----------
  "image/jpeg": {
    signatures: [{ bytes: [0xff, 0xd8, 0xff] }],
  },
  "image/png": {
    signatures: [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  },
  "image/gif": {
    signatures: [
      { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
      { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
    ],
  },
  "image/webp": {
    signatures: [
      {
        // RIFF....WEBP
        bytes: [0x52, 0x49, 0x46, 0x46],
      },
    ],
  },
  "image/bmp": {
    signatures: [{ bytes: [0x42, 0x4d] }], // BM
  },
  "image/tiff": {
    signatures: [
      { bytes: [0x49, 0x49, 0x2a, 0x00] }, // little-endian
      { bytes: [0x4d, 0x4d, 0x00, 0x2a] }, // big-endian
    ],
  },

  // ---------- Documentos ----------
  "application/pdf": {
    signatures: [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  },

  // ---------- Office (ZIP container) ----------
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    signatures: [{ bytes: [0x50, 0x4b, 0x03, 0x04] }], // PK..
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    signatures: [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    signatures: [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  },

  // ---------- ZIP genérico ----------
  "application/zip": {
    signatures: [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  },
};

/** Quantidade mínima de bytes necessários para validar qualquer assinatura do mapa. */
export const MAGIC_BYTES_READ_SIZE = 16;

/**
 * MIME types com assinatura binária conhecida — fonte de verdade da allowlist
 * de upload (`src/lib/constants/file-upload.ts`). Só aceitamos no presign o que
 * conseguimos verificar depois, no registro.
 */
export const MAGIC_BYTES_KNOWN_MIME_TYPES: readonly string[] = Object.keys(MAGIC_BYTES_MAP);

/**
 * MIME types que não possuem assinatura binária confiável (texto, CSV, etc.).
 * Para esses, a validação é ignorada (sempre retorna válido).
 */
const UNVERIFIABLE_MIME_PREFIXES = ["text/", "application/json", "application/xml"];

function isUnverifiableMime(mime: string): boolean {
  const lower = mime.toLowerCase();
  return (
    lower === "application/octet-stream" ||
    UNVERIFIABLE_MIME_PREFIXES.some((prefix) => lower.startsWith(prefix))
  );
}

function matchesSignature(header: Uint8Array, sig: MagicSignature): boolean {
  const offset = sig.offset ?? 0;
  if (header.length < offset + sig.bytes.length) return false;
  return sig.bytes.every((byte, i) => header[offset + i] === byte);
}

export type MagicBytesResult =
  | { valid: true; skipped: false }
  | { valid: true; skipped: true; reason: string }
  | { valid: false; skipped: false; declaredMime: string };

/**
 * Valida se os primeiros bytes do arquivo correspondem ao MIME declarado.
 *
 * @param header  Primeiros bytes do arquivo (mínimo `MAGIC_BYTES_READ_SIZE`).
 * @param declaredMime  MIME type informado pelo cliente.
 */
export function validateMagicBytes(header: Uint8Array, declaredMime: string): MagicBytesResult {
  const mime = declaredMime.toLowerCase().trim();

  if (isUnverifiableMime(mime)) {
    return { valid: true, skipped: true, reason: "unverifiable_mime" };
  }

  const rule = MAGIC_BYTES_MAP[mime];
  if (!rule) {
    // MIME desconhecido no mapa — não bloquear, mas sinalizar que não validou.
    return { valid: true, skipped: true, reason: "unknown_mime" };
  }

  const matched = rule.signatures.some((sig) => matchesSignature(header, sig));
  if (matched) {
    return { valid: true, skipped: false };
  }

  return { valid: false, skipped: false, declaredMime: mime };
}

/**
 * Lê os primeiros bytes de um `File` (browser) para validação de magic bytes.
 */
export function readFileHeader(file: File, size = MAGIC_BYTES_READ_SIZE): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const slice = file.slice(0, size);
    const reader = new FileReader();
    reader.onload = () => {
      resolve(new Uint8Array(reader.result as ArrayBuffer));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(slice);
  });
}

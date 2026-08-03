/**
 * Projeto GCP autorizado para o bucket de arquivos (Cloud Storage).
 *
 * Vem de `GCS_PROJECT_ID` — não é fixo no código, para o app subir em qualquer
 * projeto sem alteração de código.
 *
 * O cliente em `gcs-storage` recusa operar quando o projeto da service account
 * diverge deste valor: evita gravar arquivo clínico no projeto errado quando a
 * credencial é trocada por engano.
 */
export function getExpectedGcsProjectId(): string | null {
  return process.env.GCS_PROJECT_ID?.trim() || null;
}

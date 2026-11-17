/**
 * PUT do corpo do arquivo com eventos de progresso (upload para URL pré-assinada).
 */
export function putFileWithUploadProgress(
  uploadUrl: string,
  file: File,
  contentType: string,
  onRawPercent: (pct0to100: number) => void,
  /** Headers extras devolvidos pelo presign (`uploadHeaders`), ex.: `x-goog-content-length-range`. */
  extraHeaders?: Record<string, string>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    for (const [name, value] of Object.entries(extraHeaders ?? {})) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onRawPercent(Math.round((e.loaded / Math.max(e.total, 1)) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload falhou (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload falhou"));
    xhr.send(file);
  });
}

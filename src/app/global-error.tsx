"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Último recurso: pega erro que derrubou até o layout raiz, então não pode
 * depender de provider de i18n nem de componente da UI compartilhada.
 * Texto fixo em pt-BR de propósito.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem 1.5rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Algo quebrou</h1>
        <p style={{ marginTop: "0.75rem", color: "#666" }}>
          O erro foi registrado. Recarregue a página para continuar.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{ marginTop: "1.5rem", padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "1px solid #ccc" }}
        >
          Tentar de novo
        </button>
      </body>
    </html>
  );
}

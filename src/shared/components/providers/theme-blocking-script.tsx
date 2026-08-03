/**
 * Tema antes da hidratação (anti-FOUC), alinhado ao `next-themes` no `ThemeProvider`.
 * Script em arquivo estático + `next/script` com `src` para evitar aviso do React 19 com
 * `<script dangerouslySetInnerHTML>` na árvore de componentes.
 */
import Script from "next/script";

export function ThemeBlockingScript() {
  return (
    // A regra só reconhece `pages/_document.js`; no App Router `beforeInteractive` é
    // suportado no root layout, e é lá que este componente é renderizado
    // (`src/app/[locale]/layout.tsx`, dentro de `<head>`). Trocar a estratégia traria
    // de volta o flash de tema errado.
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
    <Script id="next-themes-block" strategy="beforeInteractive" src="/theme-hydration.js" />
  );
}

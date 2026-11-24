import { cn } from "@/lib/utils";

/** Percurso do "Trilha em S" no grid 48×48 (ver docs/BRAND.md). */
const TRAIL =
  "M31 14.5 C31 11.2 27.9 9.5 24 9.5 C20.1 9.5 17 11.4 17 15 C17 19.5 20 22.5 24 24 C28 25.5 31 28.5 31 33 C31 36.6 27.9 38.5 24 38.5 C20.1 38.5 17 36.8 17 33.5";

type BrandMarkProps = {
  className?: string;
  /**
   * `auto` segue o tema (claro: bloco tinta + traço pedra; escuro: bloco #16313f + traço céu).
   * `dark` força a versão escura, para superfícies sempre escuras (ex.: painel da marca no login).
   */
  tone?: "auto" | "dark";
  /** Texto acessível. Omitir quando o nome "SubManager" já aparece ao lado. */
  title?: string;
};

/**
 * Símbolo do SubManager: um S desenhado como jornada.
 * Nó vazado = entrada, nó cheio = etapa concluída, nó céu = etapa atual.
 * Cores vêm de `--mark-*` em globals.css.
 */
export function BrandMark({ className, tone = "auto", title }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("size-9 shrink-0", tone === "dark" && "brand-mark-dark", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <rect width="48" height="48" rx="12" fill="var(--mark-tile)" />
      <path d={TRAIL} fill="none" stroke="var(--mark-line)" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="31" cy="14.5" r="2.7" fill="var(--mark-tile)" stroke="var(--mark-line)" strokeWidth="2.4" />
      <circle cx="24" cy="24" r="2.9" fill="var(--mark-line)" stroke="var(--mark-tile)" strokeWidth="2" />
      <circle cx="17" cy="33.5" r="4.1" fill="var(--mark-now)" stroke="var(--mark-tile)" strokeWidth="2" />
    </svg>
  );
}

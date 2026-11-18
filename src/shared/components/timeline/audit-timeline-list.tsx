"use client";

import type { ClientTimelineEventCategory } from "@/types/api/clients-v1";
import { cn } from "@/lib/utils";
import {
  Building2,
  FileText,
  Scale,
  Shield,
  Stethoscope,
} from "lucide-react";

export type AuditTimelineRowModel = {
  id: string;
  category: ClientTimelineEventCategory;
  title: string;
  subtitle: string;
};

function categoryBorderClass(cat: ClientTimelineEventCategory): string {
  switch (cat) {
    case "security":
      return "border-l-foreground";
    case "clinical":
      return "border-l-success";
    case "documents":
      return "border-l-info";
    case "administrative":
      return "border-l-muted-foreground";
    case "compliance":
      return "border-l-warning";
    default:
      return "border-l-muted-foreground";
  }
}

/** Cor do ícone nos filtros quando o chip está ativo (alinhado à barra lateral da lista). */
export function timelineCategoryIconClassForActiveFilter(
  category: ClientTimelineEventCategory,
): string {
  switch (category) {
    case "security":
      return "text-foreground";
    case "clinical":
      return "text-success";
    case "documents":
      return "text-info";
    case "administrative":
      return "text-muted-foreground";
    case "compliance":
      return "text-warning";
    default:
      return "text-muted-foreground";
  }
}

/**
 * Estilo de chip para filtros da linha do tempo (ficha do cliente).
 * `disabled`: única categoria ainda selecionada — não pode desmarcar tudo.
 */
export function timelineCategoryFilterChipCn(
  category: ClientTimelineEventCategory,
  active: boolean,
  disabled: boolean,
): string {
  const base =
    "inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-xs font-medium transition-[background-color,border-color,box-shadow,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  if (disabled) {
    return cn(base, "cursor-not-allowed opacity-70");
  }

  if (!active) {
    return cn(
      base,
      "border-border/80 bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/45 active:bg-muted/60",
    );
  }

  switch (category) {
    case "security":
      return cn(
        base,
        "border-foreground/80 bg-foreground/[0.12] text-foreground shadow-sm hover:bg-foreground/[0.18]",
      );
    case "clinical":
      return cn(
        base,
        "border-success/70 bg-success/[0.11] text-success shadow-sm hover:bg-success/[0.16]",
      );
    case "documents":
      return cn(
        base,
        "border-info/75 bg-info/[0.11] text-info shadow-sm hover:bg-info/[0.17]",
      );
    case "administrative":
      return cn(
        base,
        "border-border bg-muted-foreground/[0.10] text-muted-foreground shadow-sm hover:bg-muted-foreground/[0.15]",
      );
    case "compliance":
      return cn(
        base,
        "border-warning/80 bg-warning/[0.12] text-warning shadow-sm hover:bg-warning/[0.18]",
      );
    default:
      return cn(base, "border-border bg-muted text-foreground");
  }
}

/** Ícone por categoria — reutilizado nos filtros da ficha do cliente. */
export function TimelineCategoryIcon({
  category,
  className,
}: {
  category: ClientTimelineEventCategory;
  /** Sobrescreve a cor padrão (ex.: chip ativo nos filtros). */
  className?: string;
}) {
  const cls = cn("size-4 shrink-0", className ?? "text-muted-foreground");
  switch (category) {
    case "security":
      return <Shield className={cls} aria-hidden />;
    case "clinical":
      return <Stethoscope className={cls} aria-hidden />;
    case "documents":
      return <FileText className={cls} aria-hidden />;
    case "administrative":
      return <Building2 className={cls} aria-hidden />;
    case "compliance":
      return <Scale className={cls} aria-hidden />;
    default:
      return null;
  }
}

/**
 * Lista de eventos de auditoria / jornada — mesmo layout no dashboard (`/clients/:id`) e no portal do paciente.
 */
export function AuditTimelineList({ rows }: { rows: AuditTimelineRowModel[] }) {
  return (
    <ul className="divide-border divide-y text-sm">
      {rows.map((row) => (
        <li
          key={row.id}
          className={cn(
            "flex flex-col gap-1 border-l-4 py-3 pl-3",
            categoryBorderClass(row.category),
          )}
        >
          <span className="flex items-start gap-2 font-medium">
            <TimelineCategoryIcon category={row.category} />
            <span className="min-w-0">{row.title}</span>
          </span>
          <span className="text-muted-foreground pl-6 text-xs">{row.subtitle}</span>
        </li>
      ))}
    </ul>
  );
}

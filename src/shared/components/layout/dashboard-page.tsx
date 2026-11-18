import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DashboardPageProps = {
  /** Omitir na home para não exibir cabeçalho com título. */
  title?: string;
  description?: ReactNode;
  /** Botões ou links à direita do título (ex.: “Novo paciente”). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Área de conteúdo padrão das telas autenticadas: título, descrição opcional e ações.
 */
export function DashboardPage({ title, description, actions, children, className }: DashboardPageProps) {
  const showHeader = Boolean(title || description || actions);

  return (
    <div className={cn("mx-auto flex w-full max-w-7xl flex-col gap-6", className)}>
      {showHeader ? (
        <div className="animate-enter flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-2">
            {title ? (
              <h1 className="text-foreground text-3xl leading-[1.05] font-extrabold tracking-[-0.035em] md:text-4xl">
                {title}
              </h1>
            ) : null}
            {description ? <div className="text-muted-foreground max-w-[62ch] text-[15px]">{description}</div> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

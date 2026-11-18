"use client";

import type { ReactNode } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

type InfoTooltipProps = {
  /** `aria-label` do ícone (ex.: “Mostrar explicação…”). */
  ariaLabel: string;
  /** Conteúdo da dica — visível no toque (mobile) e no hover (desktop). */
  children: ReactNode;
  /** Classes extras no botão (ex.: alinhar com `FieldLabel`). */
  triggerClassName?: string;
  /** Classes no painel do popover (ex.: `max-w-md` para textos longos). */
  popupClassName?: string;
};

/**
 * Ícone (i) com dica em popover: toque abre no celular; hover no desktop (`openOnHover`),
 * conforme recomendação do Base UI (tooltips não funcionam em touch).
 */
export function InfoTooltip({ ariaLabel, children, triggerClassName, popupClassName }: InfoTooltipProps) {
  return (
    <PopoverPrimitive.Root modal={false}>
      <PopoverPrimitive.Trigger
        openOnHover
        delay={200}
        closeDelay={80}
        type="button"
        nativeButton
        className={cn(
          "text-muted-foreground hover:bg-accent hover:text-accent-foreground shrink-0 rounded-lg p-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          "mt-0.5",
          triggerClassName,
        )}
        aria-label={ariaLabel}
      >
        <Info className="size-4" aria-hidden />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner side="bottom" align="start" sideOffset={6} className="isolate z-50">
          <PopoverPrimitive.Popup
            className={cn(
              "z-50 max-w-sm origin-(--transform-origin) rounded-lg bg-foreground px-3 py-2 text-left text-sm leading-relaxed text-balance text-background shadow-md ring-1 ring-background/10 outline-none",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              popupClassName,
            )}
          >
            {children}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

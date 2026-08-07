"use client";

import { cn } from "@/lib/utils";
import * as React from "react";

export type SwitchProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "role"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** `sm`: trilha menor (ex.: listas densas / Configurações). */
  size?: "default" | "sm";
};

const sizeStyles = {
  default: {
    track: "h-6 w-11",
    thumb: "h-5 w-5",
    thumbChecked: "translate-x-5",
    thumbUnchecked: "translate-x-0.5",
  },
  sm: {
    track: "h-5 w-9",
    thumb: "h-4 w-4",
    thumbChecked: "translate-x-4",
    thumbUnchecked: "translate-x-0.5",
  },
} as const;

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, onCheckedChange, disabled, id, size = "default", ...props }, ref) => {
    const s = sizeStyles[size];
    // `onClick` explícito precisa vir DEPOIS do spread de `props`: quando este componente é usado
    // como `render` de um `TooltipTrigger` (base-ui), o clone injeta seu próprio `onClick` em
    // `props` — se o spread vier por último, ele sobrescreve o toggle e o switch para de responder.
    const { onClick: injectedOnClick, ...restProps } = props as typeof props & {
      onClick?: React.MouseEventHandler<HTMLButtonElement>;
    };
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        data-slot="switch"
        data-size={size}
        data-state={checked ? "checked" : "unchecked"}
        disabled={disabled}
        id={id}
        className={cn(
          "peer focus-visible:ring-ring inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          s.track,
          checked ? "bg-primary" : "bg-input dark:bg-input/80",
          className,
        )}
        {...restProps}
        onClick={(e) => {
          injectedOnClick?.(e);
          if (!disabled) onCheckedChange(!checked);
        }}
      >
        <span
          className={cn(
            "bg-background pointer-events-none block rounded-full shadow-md ring-0 transition-transform",
            s.thumb,
            checked ? s.thumbChecked : s.thumbUnchecked,
          )}
          aria-hidden
        />
      </button>
    );
  },
);
Switch.displayName = "Switch";

export { Switch };

"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-[color,background-color,border-color,opacity,box-shadow,transform] duration-150 ease-out outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:not-aria-[haspopup]:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/88",
        outline:
          "border-input bg-card text-foreground hover:border-sky hover:bg-accent hover:text-foreground aria-expanded:border-sky aria-expanded:bg-accent aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "text-accent-foreground hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        destructive:
          "border-destructive/30 bg-card text-destructive hover:bg-destructive-soft focus-visible:ring-destructive",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 rounded-[min(var(--radius-md),12px)] px-3 text-[0.8125rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-10",
        "icon-xs":
          "size-7 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-9 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/** Remove props exclusivas do Base UI (render, style por estado etc.) antes de repassar ao `<button>` nativo. */
function toNativeButtonProps(
  props: Omit<ButtonPrimitive.Props, "className" | "type">,
): React.ComponentProps<"button"> {
  const { render, focusableWhenDisabled, nativeButton, style, ...nativeProps } = props
  void render
  void focusableWhenDisabled
  void nativeButton
  return { ...nativeProps, style: typeof style === "function" ? undefined : style }
}

function Button({
  className,
  variant = "default",
  size = "default",
  type,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  // Base UI merge coloca `getButtonProps` por último e força `type: "button"`, quebrando `<form>` + `type="submit"`.
  // Com `render`, o Base UI precisa controlar o elemento: não cair no `<button>` nativo (descartaria `render`).
  if ((type === "submit" || type === "reset") && props.render === undefined) {
    return (
      <button
        type={type}
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...toNativeButtonProps(props)}
      />
    );
  }

  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      type={type}
      {...props}
    />
  )
}

export { Button, buttonVariants }

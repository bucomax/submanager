"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/shared/components/ui/button"
import { XIcon } from "lucide-react"

const standardDialogSizeClass = {
  sm: "sm:max-w-md",
  default: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
} as const

export type StandardDialogSize = keyof typeof standardDialogSizeClass

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-[rgb(14_29_41/0.32)] transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-[22px] border bg-card p-6 shadow-[0_40px_90px_-30px_rgb(14_29_41/0.5)] duration-200 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 sm:max-w-lg",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-3 right-3"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-heading text-lg leading-none font-bold tracking-tight", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

type StandardDialogContentProps = Omit<DialogPrimitive.Popup.Props, "children" | "title"> & {
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  size?: StandardDialogSize
  showCloseButton?: boolean
  bodyClassName?: string
  headerClassName?: string
  footerClassName?: string
}

/**
 * Modal padrão: topo fixo (título à esquerda, fechar à direita), corpo rolável, rodapé fixo opcional.
 * Não ultrapassa a altura da tela (`max-h` com `100dvh`).
 */
function StandardDialogContent({
  title,
  description,
  footer,
  children,
  className,
  bodyClassName,
  headerClassName,
  footerClassName,
  size = "default",
  showCloseButton = true,
  ...props
}: StandardDialogContentProps) {
  const showFooter = footer != null

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="standard-dialog-content"
        className={cn(
          "bg-background fixed top-[50%] left-[50%] z-50 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[calc(100vw-1.5rem)] translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden rounded-[22px] border bg-card p-0 shadow-[0_40px_90px_-30px_rgb(14_29_41/0.5)] duration-200 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0",
          standardDialogSizeClass[size],
          className
        )}
        {...props}
      >
        <div
          data-slot="standard-dialog-header"
          className={cn(
            "border-border flex shrink-0 items-start gap-3 border-b px-5 py-4",
            headerClassName
          )}
        >
          <div className="min-w-0 flex-1 space-y-1 text-left">
            <DialogPrimitive.Title className="font-heading text-lg leading-tight font-bold tracking-tight">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-muted-foreground text-sm">
                {description}
              </DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">
                {typeof title === "string" || typeof title === "number"
                  ? String(title)
                  : "Dialog"}
              </DialogPrimitive.Description>
            )}
          </div>
          {showCloseButton ? (
            <DialogPrimitive.Close
              data-slot="standard-dialog-close"
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground shrink-0"
                />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          ) : null}
        </div>

        <div
          data-slot="standard-dialog-body"
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5",
            bodyClassName
          )}
        >
          {children}
        </div>

        {showFooter ? (
          <div
            data-slot="standard-dialog-footer"
            className={cn(
              "border-border bg-surface flex shrink-0 flex-col-reverse gap-2 border-t px-5 py-3.5 sm:flex-row sm:justify-end",
              footerClassName
            )}
          >
            {footer}
          </div>
        ) : null}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  StandardDialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}

"use client";

import { Eye, EyeOff } from "lucide-react";
import * as React from "react";
import { useTranslations } from "next-intl";
import { Controller, useFormContext } from "react-hook-form";
import { Button } from "@/shared/components/ui/button";
import { FieldLabelWithHint } from "@/shared/components/forms/field-label-with-hint";
import { Field, FieldError } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/lib/utils";

export type FormPasswordProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "name" | "type"
> & {
  name: string;
  label: string;
  description?: string;
  containerClassName?: string;
};

/**
 * Senha com botão mostrar/ocultar (shadcn Input + Button).
 */
export function FormPassword({
  name,
  label,
  description,
  className,
  containerClassName,
  id,
  autoComplete = "current-password",
  ...inputProps
}: FormPasswordProps) {
  const { control } = useFormContext();
  const inputId = id ?? name;
  const t = useTranslations("global.forms.password");
  const [visible, setVisible] = React.useState(false);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error} className={containerClassName}>
          <FieldLabelWithHint htmlFor={inputId} label={label} description={description} />
          <div className="relative flex w-full items-center gap-1">
            <Input
              id={inputId}
              {...field}
              {...inputProps}
              type={visible ? "text" : "password"}
              autoComplete={autoComplete}
              value={field.value ?? ""}
              aria-invalid={!!fieldState.error}
              aria-describedby={fieldState.error ? `${inputId}-error` : undefined}
              className={cn("pr-10", className)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              tabIndex={-1}
              className="absolute right-0.5 shrink-0"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? t("hide") : t("show")}
            >
              {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </Button>
          </div>
          <FieldError id={`${inputId}-error`}>{fieldState.error?.message ? String(fieldState.error.message) : null}</FieldError>
        </Field>
      )}
    />
  );
}

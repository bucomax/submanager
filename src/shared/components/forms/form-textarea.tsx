"use client";

import * as React from "react";
import { Controller, useFormContext } from "react-hook-form";
import { FieldLabelWithHint } from "@/shared/components/forms/field-label-with-hint";
import { Field, FieldError } from "@/shared/components/ui/field";
import { cn } from "@/lib/utils";

export type FormTextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name"> & {
  name: string;
  label: string;
  description?: string;
  containerClassName?: string;
};

export function FormTextarea({
  name,
  label,
  description,
  className,
  containerClassName,
  id,
  rows = 4,
  ...textareaProps
}: FormTextareaProps) {
  const { control } = useFormContext();
  const inputId = id ?? name;

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error} className={containerClassName}>
          <FieldLabelWithHint htmlFor={inputId} label={label} description={description} />
          <textarea
            id={inputId}
            rows={rows}
            {...field}
            {...textareaProps}
            value={field.value ?? ""}
            aria-invalid={!!fieldState.error}
            aria-describedby={fieldState.error ? `${inputId}-error` : undefined}
            className={cn(
              "border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 flex min-h-[4.5rem] w-full rounded-lg border px-2.5 py-2 text-base transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
              className,
            )}
          />
          <FieldError id={`${inputId}-error`}>{fieldState.error?.message ? String(fieldState.error.message) : null}</FieldError>
        </Field>
      )}
    />
  );
}

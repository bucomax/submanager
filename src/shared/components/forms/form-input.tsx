"use client";

import * as React from "react";
import { Controller, useFormContext } from "react-hook-form";
import { FieldLabelWithHint } from "@/shared/components/forms/field-label-with-hint";
import { Field, FieldError } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

export type FormInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "name"> & {
  name: string;
  label: string;
  description?: string;
  containerClassName?: string;
};

/**
 * Campo de texto com label, erro do Zod/RHF e descrição opcional (shadcn Field + Input).
 * Deve estar dentro de `<Form {...useForm()}>` .
 */
export function FormInput({
  name,
  label,
  description,
  className,
  containerClassName,
  id,
  ...inputProps
}: FormInputProps) {
  const { control } = useFormContext();
  const inputId = id ?? name;

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error} className={containerClassName}>
          <FieldLabelWithHint htmlFor={inputId} label={label} description={description} />
          <Input
            id={inputId}
            {...field}
            {...inputProps}
            value={field.value ?? ""}
            aria-invalid={!!fieldState.error}
            aria-describedby={fieldState.error ? `${inputId}-error` : undefined}
            className={className}
          />
          <FieldError id={`${inputId}-error`}>{fieldState.error?.message ? String(fieldState.error.message) : null}</FieldError>
        </Field>
      )}
    />
  );
}

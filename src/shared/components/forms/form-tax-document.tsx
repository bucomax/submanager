"use client";

import { Controller, useFormContext } from "react-hook-form";
import { FieldLabelWithHint } from "@/shared/components/forms/field-label-with-hint";
import { Field, FieldError } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { digitsOnlyTaxDocument, formatTaxDocumentDisplay } from "@/lib/validators/tax-document";

export type FormTaxDocumentProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "name" | "type" | "onChange" | "value"
> & {
  name: string;
  label: string;
  description?: string;
  containerClassName?: string;
};

/** CPF ou CNPJ: valor no RHF = apenas dígitos (11 ou 14); máscara na UI. */
export function FormTaxDocument({
  name,
  label,
  description,
  className,
  containerClassName,
  id,
  inputMode = "numeric",
  autoComplete = "off",
  ...inputProps
}: FormTaxDocumentProps) {
  const { control } = useFormContext();
  const inputId = id ?? name;

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const raw = typeof field.value === "string" ? field.value : "";
        const display = formatTaxDocumentDisplay(raw);

        return (
          <Field data-invalid={!!fieldState.error} className={containerClassName}>
            <FieldLabelWithHint htmlFor={inputId} label={label} description={description} />
            <Input
              id={inputId}
              {...inputProps}
              type="text"
              inputMode={inputMode}
              autoComplete={autoComplete}
              value={display}
              onChange={(e) => {
                field.onChange(digitsOnlyTaxDocument(e.target.value));
              }}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              aria-invalid={!!fieldState.error}
              aria-describedby={fieldState.error ? `${inputId}-error` : undefined}
              className={className}
            />
            <FieldError id={`${inputId}-error`}>{fieldState.error?.message ? String(fieldState.error.message) : null}</FieldError>
          </Field>
        );
      }}
    />
  );
}

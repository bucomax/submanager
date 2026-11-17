"use client";

import * as React from "react";
import { Controller, useFormContext } from "react-hook-form";
import { FieldLabelWithHint } from "@/shared/components/forms/field-label-with-hint";
import { Field, FieldError } from "@/shared/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { cn } from "@/lib/utils";

export type FormSelectOption = { value: string; label: string; disabled?: boolean };

export type FormSelectProps = {
  name: string;
  label: string;
  description?: string;
  options: FormSelectOption[];
  placeholder?: string;
  containerClassName?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
};

/**
 * Select (shadcn) com validação RHF + Zod.
 */
export function FormSelect({
  name,
  label,
  description,
  options,
  placeholder,
  className,
  containerClassName,
  id,
  disabled,
}: FormSelectProps) {
  const { control } = useFormContext();
  const selectId = id ?? name;

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const value =
          field.value === "" || field.value === undefined ? undefined : String(field.value);
        const selectedLabel = options.find((opt) => opt.value === value)?.label;

        return (
          <Field data-invalid={!!fieldState.error} className={containerClassName}>
            <FieldLabelWithHint htmlFor={selectId} label={label} description={description} />
            <Select
              name={name}
              value={value}
              onValueChange={(v) => field.onChange(v ?? "")}
              disabled={disabled}
            >
              <SelectTrigger
                id={selectId}
                className={cn("w-full", className)}
                aria-invalid={!!fieldState.error}
                aria-describedby={fieldState.error ? `${selectId}-error` : undefined}
              >
                <SelectValue placeholder={placeholder ?? "Selecione…"}>{selectedLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError id={`${selectId}-error`}>{fieldState.error?.message ? String(fieldState.error.message) : null}</FieldError>
          </Field>
        );
      }}
    />
  );
}

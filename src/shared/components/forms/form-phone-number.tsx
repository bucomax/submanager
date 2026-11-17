"use client";

import * as React from "react";
import type { ControllerFieldState } from "react-hook-form";
import { Controller, useFormContext } from "react-hook-form";
import { FieldLabelWithHint } from "@/shared/components/forms/field-label-with-hint";
import { Field, FieldError } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { digitsOnlyPhone, formatPhoneBrDisplay } from "@/lib/validators/phone";

export type FormPhoneNumberProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "name" | "type" | "onChange" | "value"
> & {
  name: string;
  label: string;
  description?: string;
  containerClassName?: string;
};

/** Bridge mínimo do `field` do Controller (valor só dígitos no submit). */
type PhoneRhfField = {
  value: unknown;
  onChange: (value: string) => void;
  onBlur: () => void;
  name: string;
  ref: React.RefCallback<HTMLInputElement | null>;
};

type PhoneNumberControlledInputProps = {
  field: PhoneRhfField;
  fieldState: ControllerFieldState;
  inputId: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  className?: string;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "id" | "type" | "inputMode" | "autoComplete" | "name" | "value" | "onChange" | "onBlur" | "ref"
>;

/**
 * Input controlado: o valor no RHF é só dígitos; a máscara é só visual.
 * Navegadores podem autofill o input sem disparar onChange do React — o estado
 * fica "" e o Zod acusa telefone vazio. Sincronizamos DOM → RHF no layout (pós-pintura)
 * e no blur.
 */
function PhoneNumberControlledInput({
  field,
  fieldState,
  inputId,
  inputMode = "tel",
  autoComplete = "tel",
  className,
  ...inputProps
}: PhoneNumberControlledInputProps) {
  const digits = typeof field.value === "string" ? field.value : "";
  const display = formatPhoneBrDisplay(digits);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const { onChange, onBlur, name, ref: fieldRef } = field;

  const syncDomIntoField = React.useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const fromDom = digitsOnlyPhone(el.value);
    if (fromDom !== digits) {
      onChange(fromDom);
    }
  }, [digits, onChange]);

  React.useLayoutEffect(() => {
    syncDomIntoField();
    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(syncDomIntoField);
    });
    return () => {
      cancelAnimationFrame(outerRaf);
      if (innerRaf) cancelAnimationFrame(innerRaf);
    };
  }, [syncDomIntoField]);

  return (
    <Input
      id={inputId}
      {...inputProps}
      type="text"
      inputMode={inputMode}
      autoComplete={autoComplete}
      value={display}
      onChange={(e) => {
        onChange(digitsOnlyPhone(e.target.value));
      }}
      onInput={() => {
        syncDomIntoField();
      }}
      onBlur={(e) => {
        const fromDom = digitsOnlyPhone(e.target.value);
        if (fromDom !== digits) {
          onChange(fromDom);
        }
        onBlur();
      }}
      name={name}
      ref={(node) => {
        inputRef.current = node;
        fieldRef(node);
      }}
      aria-invalid={!!fieldState.error}
      aria-describedby={fieldState.error ? `${inputId}-error` : undefined}
      className={className}
    />
  );
}

/**
 * Telefone BR: valor no formulário = apenas dígitos (compatível com `phoneDigitsSchema`).
 * Exibição formatada (XX) XXXXX-XXXX.
 */
export function FormPhoneNumber({
  name,
  label,
  description,
  className,
  containerClassName,
  id,
  inputMode = "tel",
  autoComplete = "tel",
  ...inputProps
}: FormPhoneNumberProps) {
  const { control } = useFormContext();
  const inputId = id ?? name;

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error} className={containerClassName}>
          <FieldLabelWithHint htmlFor={inputId} label={label} description={description} />
          <PhoneNumberControlledInput
            field={field as PhoneRhfField}
            fieldState={fieldState}
            inputId={inputId}
            inputMode={inputMode}
            autoComplete={autoComplete}
            className={className}
            {...inputProps}
          />
          <FieldError id={`${inputId}-error`}>{fieldState.error?.message ? String(fieldState.error.message) : null}</FieldError>
        </Field>
      )}
    />
  );
}

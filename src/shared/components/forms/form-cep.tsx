"use client";

import * as React from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { lookupCep } from "@/lib/utils/cep-lookup";
import { digitsOnlyCep, formatCepDisplay } from "@/lib/validators/cep";
import { FieldLabelWithHint } from "@/shared/components/forms/field-label-with-hint";
import { Field, FieldError } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Loader2 } from "lucide-react";

export type FormCepProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "name" | "type" | "onChange" | "value"
> & {
  name: string;
  label: string;
  description?: string;
  containerClassName?: string;
  addressLineField?: string;
  neighborhoodField?: string;
  cityField?: string;
  stateField?: string;
};

/** CEP: valor no formulário = 8 dígitos; máscara na UI; ViaCEP preenche logradouro/bairro/cidade/UF. */
export function FormCep({
  name,
  label,
  description,
  className,
  containerClassName,
  id,
  inputMode = "numeric",
  autoComplete = "postal-code",
  addressLineField = "addressLine",
  neighborhoodField = "neighborhood",
  cityField = "city",
  stateField = "state",
  ...inputProps
}: FormCepProps) {
  const { control, setValue } = useFormContext();
  const inputId = id ?? name;
  const watched = useWatch({ control, name });
  const digits = typeof watched === "string" ? digitsOnlyCep(watched) : "";
  const [loading, setLoading] = React.useState(false);
  const lastFetched = React.useRef<string>("");

  React.useEffect(() => {
    if (digits.length !== 8) {
      lastFetched.current = "";
      return;
    }
    if (lastFetched.current === digits) return;
    lastFetched.current = digits;
    let cancelled = false;
    setLoading(true);
    void lookupCep(digits).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res) return;
      setValue(addressLineField, res.addressLine, { shouldDirty: true, shouldValidate: false });
      setValue(neighborhoodField, res.neighborhood, { shouldDirty: true, shouldValidate: false });
      setValue(cityField, res.city, { shouldDirty: true, shouldValidate: false });
      setValue(stateField, res.state, { shouldDirty: true, shouldValidate: false });
    });
    return () => {
      cancelled = true;
    };
  }, [digits, setValue, addressLineField, neighborhoodField, cityField, stateField]);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const raw = typeof field.value === "string" ? field.value : "";
        const display = formatCepDisplay(raw);

        return (
          <Field data-invalid={!!fieldState.error} className={containerClassName}>
            <FieldLabelWithHint htmlFor={inputId} label={label} description={description} />
            <div className="relative">
              <Input
                id={inputId}
                {...inputProps}
                type="text"
                inputMode={inputMode}
                autoComplete={autoComplete}
                value={display}
                onChange={(e) => {
                  field.onChange(digitsOnlyCep(e.target.value));
                }}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                aria-invalid={!!fieldState.error}
                aria-describedby={fieldState.error ? `${inputId}-error` : undefined}
                className={className}
              />
              {loading ? (
                <Loader2
                  className="text-muted-foreground pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin"
                  aria-hidden
                />
              ) : null}
            </div>
            <FieldError id={`${inputId}-error`}>{fieldState.error?.message ? String(fieldState.error.message) : null}</FieldError>
          </Field>
        );
      }}
    />
  );
}

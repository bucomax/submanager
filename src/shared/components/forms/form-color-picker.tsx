"use client";

import * as React from "react";
import { useCallback, useRef, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { FieldLabelWithHint } from "@/shared/components/forms/field-label-with-hint";
import { Field, FieldError } from "@/shared/components/ui/field";
import { cn } from "@/lib/utils";
import { PaletteIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

// ---------------------------------------------------------------------------
// Preset colors
// ---------------------------------------------------------------------------

const PRESET_COLORS = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308",
  "#84CC16", "#22C55E", "#10B981", "#14B8A6",
  "#06B6D4", "#0EA5E9", "#3B82F6", "#6366F1",
  "#8B5CF6", "#A855F7", "#D946EF", "#EC4899",
  "#F43F5E", "#78716C", "#64748B", "#1E293B",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FormColorPickerProps = {
  name: string;
  label: string;
  description?: string;
  containerClassName?: string;
  disabled?: boolean;
  id?: string;
  /** Allow clearing (empty string) */
  clearable?: boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FormColorPicker({
  name,
  label,
  description,
  containerClassName,
  id,
  disabled,
  clearable = true,
}: FormColorPickerProps) {
  const { control } = useFormContext();
  const pickerId = id ?? name;

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error} className={containerClassName}>
          <FieldLabelWithHint htmlFor={pickerId} label={label} description={description} />
          <ColorPickerInput
            id={pickerId}
            value={field.value ?? ""}
            onChange={(v) => field.onChange(v)}
            disabled={disabled}
            invalid={!!fieldState.error}
            errorId={`${pickerId}-error`}
            clearable={clearable}
          />
          <FieldError>{fieldState.error?.message ? String(fieldState.error.message) : null}</FieldError>
        </Field>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Standalone input
// ---------------------------------------------------------------------------

type ColorPickerInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  errorId?: string;
  clearable?: boolean;
};

function ColorPickerInput({
  id,
  value,
  onChange,
  disabled,
  invalid,
  errorId,
  clearable,
}: ColorPickerInputProps) {
  const t = useTranslations("global.forms.colorPicker");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);

  const isValidHex = /^#[0-9a-fA-F]{6}$/.test(value);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value;
      // Auto-prefix with #
      if (val && !val.startsWith("#")) val = `#${val}`;
      // Limit to 7 chars (#RRGGBB)
      if (val.length > 7) val = val.slice(0, 7);
      onChange(val);
    },
    [onChange],
  );

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent pr-2 pl-2.5 text-sm transition-colors",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          disabled && "cursor-not-allowed opacity-50",
          invalid && "border-destructive ring-3 ring-destructive/20",
          "dark:bg-input/30",
        )}
      >
        {/* Color swatch button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="flex shrink-0 items-center gap-1.5"
          aria-label={t("select")}
        >
          {isValidHex ? (
            <span
              className="size-5 rounded border border-foreground/10"
              style={{ backgroundColor: value }}
            />
          ) : (
            <PaletteIcon className="size-4 text-muted-foreground" />
          )}
        </button>

        {/* Text input */}
        <input
          id={id}
          type="text"
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          value={value}
          onChange={handleTextChange}
          onFocus={() => setOpen(true)}
          disabled={disabled}
          placeholder="#3B82F6"
          className="h-full w-full min-w-0 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
          maxLength={7}
        />

        {/* Native color input (hidden) */}
        <input
          ref={nativeInputRef}
          type="color"
          value={isValidHex ? value : "#3B82F6"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="invisible absolute size-0"
          tabIndex={-1}
        />

        {/* Actions */}
        <span className="flex shrink-0 items-center gap-0.5">
          {clearable && value && (
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={disabled}
              className="rounded p-0.5 hover:bg-muted"
            >
              <XIcon className="size-3 text-muted-foreground" />
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => nativeInputRef.current?.click()}
            className="rounded p-0.5 hover:bg-muted"
            title={t("openSystemPicker")}
            aria-label={t("openSystemPicker")}
          >
            <PaletteIcon className="size-3.5 text-muted-foreground" />
          </button>
        </span>
      </div>

      {/* Preset palette dropdown */}
      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover p-3 shadow-md ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
          <div className="grid grid-cols-10 gap-1.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={cn(
                  "size-6 rounded-md border transition-all hover:scale-110",
                  value.toUpperCase() === color.toUpperCase()
                    ? "ring-2 ring-ring ring-offset-2 ring-offset-background"
                    : "border-foreground/10",
                )}
                style={{ backgroundColor: color }}
                onClick={() => {
                  onChange(color);
                  setOpen(false);
                }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

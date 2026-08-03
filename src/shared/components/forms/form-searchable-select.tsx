"use client";

import * as React from "react";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { FieldLabelWithHint } from "@/shared/components/forms/field-label-with-hint";
import { Field, FieldError } from "@/shared/components/ui/field";
import { cn } from "@/lib/utils";
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SearchableSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  /** Optional icon/element rendered before the label */
  icon?: React.ReactNode;
  /** Searchable keywords (label is always searched) */
  keywords?: string[];
};

export type FormSearchableSelectProps = {
  name: string;
  label: string;
  description?: string;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  containerClassName?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Allow clearing the selection */
  clearable?: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function matchOption(option: SearchableSelectOption, query: string): boolean {
  if (!query) return true;
  const q = normalize(query);
  if (normalize(option.label).includes(q)) return true;
  if (option.keywords?.some((kw) => normalize(kw).includes(q))) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FormSearchableSelect({
  name,
  label,
  description,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  className,
  containerClassName,
  id,
  disabled,
  clearable,
}: FormSearchableSelectProps) {
  const { control } = useFormContext();
  const selectId = id ?? name;

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error} className={containerClassName}>
          <FieldLabelWithHint htmlFor={selectId} label={label} description={description} />
          <SearchableSelectDropdown
            id={selectId}
            value={field.value === "" || field.value === undefined ? undefined : String(field.value)}
            onChange={(v) => field.onChange(v ?? "")}
            options={options}
            placeholder={placeholder}
            searchPlaceholder={searchPlaceholder}
            emptyMessage={emptyMessage}
            disabled={disabled}
            invalid={!!fieldState.error}
            className={className}
            clearable={clearable}
          />
          <FieldError>{fieldState.error?.message ? String(fieldState.error.message) : null}</FieldError>
        </Field>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Standalone dropdown (can be used without RHF)
// ---------------------------------------------------------------------------

export type SearchableSelectDropdownProps = {
  id?: string;
  value?: string;
  onChange: (value: string | undefined) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  clearable?: boolean;
};

export function SearchableSelectDropdown({
  id,
  value,
  onChange,
  options,
  placeholder = "Selecione…",
  searchPlaceholder = "Buscar…",
  emptyMessage = "Nenhum resultado.",
  disabled,
  invalid,
  className,
  clearable,
}: SearchableSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);
  /** `role="combobox"` exige `aria-controls` apontando para a lista de opções. */
  const fallbackId = useId();
  const listboxId = `${id ?? fallbackId}-listbox`;

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  const filtered = useMemo(
    () => options.filter((o) => matchOption(o, search)),
    [options, search],
  );

  const openDropdown = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setSearch("");
    setHighlightIndex(0);
    // Focus input after render
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [disabled]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);

  const selectOption = useCallback(
    (opt: SearchableSelectOption) => {
      onChange(opt.value);
      closeDropdown();
    },
    [onChange, closeDropdown],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(undefined);
    },
    [onChange],
  );

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, closeDropdown]);

  const scrollToIndex = useCallback((index: number) => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[index] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          openDropdown();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightIndex((i) => {
            const next = Math.min(i + 1, filtered.length - 1);
            scrollToIndex(next);
            return next;
          });
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightIndex((i) => {
            const next = Math.max(i - 1, 0);
            scrollToIndex(next);
            return next;
          });
          break;
        case "Enter":
          e.preventDefault();
          if (filtered[highlightIndex] && !filtered[highlightIndex].disabled) {
            selectOption(filtered[highlightIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          closeDropdown();
          break;
      }
    },
    [open, filtered, highlightIndex, openDropdown, closeDropdown, selectOption, scrollToIndex],
  );

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      {/* Trigger */}
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? closeDropdown() : openDropdown())}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
          "dark:bg-input/30 dark:hover:bg-input/50",
          className,
        )}
      >
        <span className={cn("flex flex-1 items-center gap-1.5 truncate text-left", !selectedOption && "text-muted-foreground")}>
          {selectedOption ? (
            <>
              {selectedOption.icon}
              {selectedOption.label}
            </>
          ) : (
            placeholder
          )}
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          {clearable && value && (
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClear}
              className="rounded p-0.5 hover:bg-muted"
            >
              <XIcon className="size-3 text-muted-foreground" />
            </span>
          )}
          <ChevronDownIcon className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-md ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
          {/* Search input */}
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightIndex(0);
              }}
              placeholder={searchPlaceholder}
              className="h-6 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              aria-label={searchPlaceholder}
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(""); inputRef.current?.focus(); }}
                className="rounded p-0.5 hover:bg-muted"
              >
                <XIcon className="size-3 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Options list */}
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            className="max-h-56 overflow-y-auto p-1"
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              filtered.map((opt, idx) => (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === value}
                  aria-disabled={opt.disabled}
                  data-highlighted={idx === highlightIndex || undefined}
                  className={cn(
                    "relative flex w-full cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm select-none",
                    "data-highlighted:bg-accent data-highlighted:text-accent-foreground",
                    opt.disabled && "pointer-events-none opacity-50",
                    !opt.disabled && "cursor-pointer",
                  )}
                  onClick={() => !opt.disabled && selectOption(opt)}
                  onMouseEnter={() => setHighlightIndex(idx)}
                >
                  {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                  <span className="flex-1 truncate">{opt.label}</span>
                  {opt.value === value && (
                    <CheckIcon className="absolute right-2 size-4" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

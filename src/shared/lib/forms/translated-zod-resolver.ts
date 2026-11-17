"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { FieldErrors, FieldValues, Resolver, ResolverOptions } from "react-hook-form";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { ZodType } from "zod";

import { translateZodApiMessage } from "@/lib/api/zod-i18n";

function translateFieldErrors<T extends FieldValues>(
  errors: FieldErrors<T>,
  t: (key: string) => string,
): FieldErrors<T> {
  const walk = (node: unknown): unknown => {
    if (node == null || typeof node !== "object") return node;
    const n = node as Record<string, unknown>;
    const copy: Record<string, unknown> = { ...n };
    if (typeof copy.message === "string") {
      copy.message = translateZodApiMessage(copy.message, t);
    }
    if (copy.types && typeof copy.types === "object" && !Array.isArray(copy.types)) {
      copy.types = Object.fromEntries(
        Object.entries(copy.types as Record<string, unknown>).map(([tk, tv]) => [
          tk,
          typeof tv === "string" ? translateZodApiMessage(tv, t) : tv,
        ]),
      );
    }
    for (const [k, v] of Object.entries(copy)) {
      if (k === "message" || k === "type" || k === "types" || k === "ref") continue;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        copy[k] = walk(v);
      }
    }
    return copy;
  };

  const out = {} as FieldErrors<T>;
  for (const key of Object.keys(errors)) {
    (out as Record<string, unknown>)[key] = walk(errors[key as keyof FieldErrors<T>]);
  }
  return out;
}

/** Resolver RHF que traduz mensagens `@api/...` com `useTranslations('api')`. */
export function translatedZodResolver<T extends FieldValues>(
  schema: ZodType<FieldValues, FieldValues>,
  tApi: (key: string) => string,
): Resolver<T> {
  const base = zodResolver(schema);
  return (async (values, config, options) => {
    const result = await base(values, config, options as ResolverOptions<FieldValues>);
    if (result.errors && Object.keys(result.errors).length > 0) {
      return {
        ...result,
        errors: translateFieldErrors(result.errors, tApi),
      };
    }
    return result;
  }) as Resolver<T>;
}

/** Hook: resolver RHF com mensagens `@api/...` traduzidas (namespace `api`). */
export function useTranslatedZodResolver<T extends FieldValues>(
  schema: ZodType<FieldValues, FieldValues>,
): Resolver<T> {
  const tApi = useTranslations("api");
  return useMemo(
    () => translatedZodResolver<T>(schema, (key) => tApi(key as Parameters<typeof tApi>[0])),
    [schema, tApi],
  );
}

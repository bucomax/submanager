"use client";

import { QueryClientProvider } from "@tanstack/react-query";

import { getQueryClient } from "@/shared/lib/query/query-client";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}

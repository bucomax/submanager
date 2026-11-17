"use client";

import { SessionProvider } from "next-auth/react";
import { QueryProvider } from "@/shared/components/providers/query-provider";
import { ZodLocaleProvider } from "@/shared/components/providers/zod-locale-provider";

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <QueryProvider>
        <ZodLocaleProvider>{children}</ZodLocaleProvider>
      </QueryProvider>
    </SessionProvider>
  );
}

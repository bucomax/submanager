"use client";

import { SessionProvider } from "next-auth/react";
import { ZodLocaleProvider } from "@/shared/components/providers/zod-locale-provider";

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ZodLocaleProvider>{children}</ZodLocaleProvider>
    </SessionProvider>
  );
}

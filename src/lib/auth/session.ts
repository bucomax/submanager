import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth-options";

/** Sessão no servidor (Route Handlers, Server Components). */
export function getSession() {
  return getServerSession(authOptions);
}

/** `expires` da sessão NextAuth já passou (ISO string). */
export function isSessionExpired(expires: string | undefined, now: number = Date.now()): boolean {
  if (!expires) return false;
  return new Date(expires).getTime() < now;
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NotificationBell } from "@/features/notifications/app/components/notification-bell";
import { NotificationPermissionBanner } from "@/features/notifications/app/components/notification-permission-banner";
import { AppShell } from "@/shared/components/layout/app-shell";
import { getSession, isSessionExpired } from "@/lib/auth/session";

/**
 * Rotas autenticadas sob `/dashboard/*`: shell compartilhado (shared), nao feature.
 * Quando a sessao e invalida (ex.: DB resetado), limpa o cookie JWT para evitar loop.
 */
export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  const isExpired = isSessionExpired(session?.expires);

  if (!session?.user?.id || isExpired) {
    const cookieStore = await cookies();
    cookieStore.delete("next-auth.session-token");
    cookieStore.delete("__Secure-next-auth.session-token");
    redirect("/login");
  }

  const u = session!.user;

  return (
    <AppShell
      user={{
        id: u.id,
        email: u.email ?? null,
        name: u.name,
        globalRole: u.globalRole,
        tenantId: u.tenantId,
        tenantRole: u.tenantRole,
      }}
      headerSlots={<NotificationBell />}
      afterHeader={<NotificationPermissionBanner />}
    >
      {children}
    </AppShell>
  );
}

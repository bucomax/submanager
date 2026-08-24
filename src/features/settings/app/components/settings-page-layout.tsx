"use client";

import { AdminAppList } from "@/features/apps/app/components/admin-app-list";
import { PathwayStagesSettingsPanel } from "@/features/pathways/app/components/pathway-stages-settings-panel";
import { ClinicSettingsCard } from "@/features/settings/app/components/clinic-settings-card";
import { FeedbackTriageCard } from "@/features/settings/app/components/feedback-triage-card";
import { OpmeSuppliersCard } from "@/features/settings/app/components/opme-suppliers-card";
import { SuperAdminTenantsCard } from "@/features/settings/app/components/super-admin-tenants-card";
import { EmailSettingsCard } from "@/features/settings/app/components/email-settings-card";
import { TenantNotificationsCard } from "@/features/settings/app/components/tenant-notifications-card";
import { UserSettingsPanel } from "@/features/settings/app/components/user-settings-panel";
import { UsersManagementPanel } from "@/features/settings/app/components/users-management-panel";
import { useSectionFromHash } from "@/features/settings/app/hooks/use-section-from-hash";
import {
  sectionFromHash,
  type SettingsSectionId,
} from "@/features/settings/app/utils/section-hash";
import { cn } from "@/lib/utils";
import {
  Bell,
  Blocks,
  Building2,
  ClipboardList,
  Factory,
  Mail,
  MessageSquareWarning,
  Shield,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "@/i18n/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type NavDef = { id: SettingsSectionId; icon: LucideIcon; superAdminOnly?: boolean; tenantAdminOnly?: boolean };

const NAV_DEFS: NavDef[] = [
  { id: "account", icon: User },
  { id: "clinic", icon: Building2 },
  { id: "notifications", icon: Bell },
  { id: "email", icon: Mail, tenantAdminOnly: true },
  { id: "team", icon: Users, tenantAdminOnly: true },
  { id: "opme", icon: Factory },
  { id: "phases", icon: ClipboardList },
  { id: "apps", icon: Blocks, superAdminOnly: true },
  { id: "feedback", icon: MessageSquareWarning, superAdminOnly: true },
  { id: "admin", icon: Shield, superAdminOnly: true },
];

const FADE_MS = 200;

export function SettingsPageLayout() {
  const t = useTranslations("settings.sectionsNav");
  const pathname = usePathname();
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.globalRole === "super_admin";
  const isTenantAdminOrSuper =
    session?.user?.tenantRole === "tenant_admin" || session?.user?.globalRole === "super_admin";

  const navItems = useMemo(
    () =>
      NAV_DEFS.filter(
        (item) =>
          (!item.superAdminOnly || isSuperAdmin) && (!item.tenantAdminOnly || isTenantAdminOrSuper),
      ),
    [isSuperAdmin, isTenantAdminOrSuper],
  );

  /** Seção escolhida por clique; enquanto for `null`, o hash da URL manda. */
  const [selectedSection, setSelectedSection] = useState<SettingsSectionId | null>(null);
  const hashSection = useSectionFromHash();
  const requestedSection = selectedSection ?? hashSection ?? "account";
  /** `navItems` depende da sessão: seção fora do menu atual cai para "account". */
  const activeSection = navItems.some((i) => i.id === requestedSection)
    ? requestedSection
    : "account";
  const [panelVisible, setPanelVisible] = useState(true);
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipHashReplaceRef = useRef(false);

  useEffect(() => {
    function onHashChange() {
      const id = sectionFromHash(window.location.hash);
      if (id && navItems.some((i) => i.id === id)) {
        skipHashReplaceRef.current = true;
        setSelectedSection(id);
        setPanelVisible(true);
      }
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [navItems]);

  useEffect(() => {
    if (skipHashReplaceRef.current) {
      skipHashReplaceRef.current = false;
      return;
    }
    if (typeof window === "undefined") return;
    const desired = `#${activeSection}`;
    if (window.location.hash === desired) return;
    // Enquanto nenhuma seção foi escolhida por clique, um hash válido na URL manda.
    // Sem esta guarda, o primeiro commit (antes de `useSectionFromHash` estabilizar
    // após a hidratação) sobrescreveria `/settings#team` por `#account`.
    const urlSection = sectionFromHash(window.location.hash);
    if (selectedSection === null && urlSection !== null && navItems.some((i) => i.id === urlSection)) {
      return;
    }
    window.history.replaceState(null, "", `${pathname}${desired}`);
  }, [activeSection, navItems, pathname, selectedSection]);

  const goToSection = useCallback(
    (id: SettingsSectionId) => {
      if (id === activeSection) return;
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
        fadeTimeoutRef.current = null;
      }
      setPanelVisible(false);
      fadeTimeoutRef.current = setTimeout(() => {
        setSelectedSection(id);
        setPanelVisible(true);
        fadeTimeoutRef.current = null;
      }, FADE_MS);
    },
    [activeSection],
  );

  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, []);

  const panelContent = useMemo(() => {
    switch (activeSection) {
      case "account":
        return <UserSettingsPanel />;
      case "clinic":
        return <ClinicSettingsCard />;
      case "notifications":
        return <TenantNotificationsCard />;
      case "email":
        return <EmailSettingsCard />;
      case "team":
        return <UsersManagementPanel />;
      case "opme":
        return <OpmeSuppliersCard />;
      case "phases":
        return <PathwayStagesSettingsPanel className="mt-0" />;
      case "apps":
        return <AdminAppList />;
      case "feedback":
        return <FeedbackTriageCard />;
      case "admin":
        return <SuperAdminTenantsCard />;
      default:
        return null;
    }
  }, [activeSection]);

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <nav
        aria-label={t("aria")}
        className="scrollbar-thin flex flex-row gap-1 overflow-x-auto pb-1 lg:sticky lg:top-[4.5rem] lg:flex lg:w-full lg:flex-col lg:gap-0.5 lg:overflow-visible lg:rounded-xl lg:border lg:bg-card lg:p-3 lg:shadow-sm"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => goToSection(item.id)}
              className={cn(
                "flex min-w-[10rem] shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors duration-200 lg:min-w-0",
                "text-muted-foreground hover:bg-muted",
                isActive && "bg-primary/10 text-primary hover:bg-primary/15",
              )}
            >
              <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
              <span>{t(item.id)}</span>
            </button>
          );
        })}
      </nav>

      <div
        aria-live="polite"
        className={cn(
          "min-h-[12rem] min-w-0 transition-opacity duration-200 ease-out",
          panelVisible ? "opacity-100" : "opacity-0",
        )}
      >
        {panelContent}
      </div>
    </div>
  );
}

"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { FeedbackFooterTrigger } from "@/features/feedback/app/components/feedback-launcher";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/shared/components/ui/sidebar";
import type { AppShellUser } from "@/shared/types/layout";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  GitBranch,
  Home,
  LogOut,
  MessageCircle,
  Settings,
  Store,
  Stethoscope,
  UserPen,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
import { useEffect } from "react";
import { useActiveApps } from "@/features/apps/app/hooks/use-active-apps";
import { AppIcon } from "@/features/apps/app/components/app-icon";

type NavItem = {
  href: string;
  labelKey: "home" | "clients" | "contacts" | "agenda" | "pathways" | "reports" | "marketplace" | "settings";
  icon: LucideIcon;
  match: (p: string) => boolean;
};

const navGroups: { labelKey: "principal" | "sistema"; items: NavItem[] }[] = [
  {
    labelKey: "principal",
    items: [
      {
        href: "/dashboard",
        labelKey: "home",
        icon: Home,
        match: (p) => p === "/dashboard" || p === "/dashboard/",
      },
      {
        href: "/dashboard/clients",
        labelKey: "clients",
        icon: Users,
        match: (p) => p.startsWith("/dashboard/clients"),
      },
      {
        href: "/dashboard/contacts",
        labelKey: "contacts",
        icon: MessageCircle,
        match: (p) => p.startsWith("/dashboard/contacts"),
      },
      {
        href: "/dashboard/agenda",
        labelKey: "agenda",
        icon: CalendarDays,
        match: (p) => p.startsWith("/dashboard/agenda"),
      },
      {
        href: "/dashboard/pathways",
        labelKey: "pathways",
        icon: GitBranch,
        match: (p) => p.startsWith("/dashboard/pathways"),
      },
      {
        href: "/dashboard/reports",
        labelKey: "reports",
        icon: BarChart3,
        match: (p) => p.startsWith("/dashboard/reports"),
      },
      {
        href: "/dashboard/apps",
        labelKey: "marketplace",
        icon: Store,
        match: (p) => p.startsWith("/dashboard/apps"),
      },
      {
        href: "/dashboard/settings#account",
        labelKey: "settings",
        icon: Settings,
        match: (p) => p.startsWith("/dashboard/settings"),
      }
    ],
  }
];

type AppSidebarProps = {
  user: AppShellUser;
};

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const t = useTranslations("dashboard");
  const tBrand = useTranslations("global");
  const tShell = useTranslations("dashboard.shell");
  const loginCallback = "/login";
  const { apps: activeApps } = useActiveApps();

  function closeMobileNav() {
    if (isMobile) setOpenMobile(false);
  }

  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-sidebar-border flex h-14 shrink-0 flex-row items-center border-b px-2 py-0">
        <Link
          href="/dashboard"
          onClick={closeMobileNav}
          className="flex h-14 w-full items-center gap-2 rounded-md px-2 text-sm font-semibold outline-none ring-sidebar-ring focus-visible:ring-2"
        >
          <Stethoscope className="size-5 shrink-0 text-sidebar-primary" />
          <span className="group-data-[collapsible=icon]:hidden">{tBrand("brand")}</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.labelKey}>
            <SidebarGroupLabel>{t(`nav.${group.labelKey}`)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const label = t(`nav.${item.labelKey}`);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        tooltip={label}
                        isActive={item.match(pathname)}
                        render={<Link href={item.href} onClick={closeMobileNav} />}
                      >
                        <item.icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {activeApps.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>{t("nav.appsGroup")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {activeApps.map((app) => {
                  const href = `/dashboard/apps/${app.slug}`;
                  const isActive = pathname.startsWith(href);
                  return (
                    <SidebarMenuItem key={app.slug}>
                      <SidebarMenuButton
                        tooltip={app.name}
                        isActive={isActive}
                        render={<Link href={href} onClick={closeMobileNav} />}
                      >
                        <AppIcon iconUrl={app.iconUrl} accentColor={app.accentColor} size="xs" />
                        <span>{app.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter className="p-2 group-data-[collapsible=icon]:hidden">
        <FeedbackFooterTrigger />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="sm" className="h-auto w-full justify-between gap-2 px-2 py-2">
                <div className="min-w-0 text-left">
                  <p className="truncate text-sm font-medium">{user.name?.trim() || tShell("account")}</p>
                  <p className="text-muted-foreground truncate text-xs">{user.email}</p>
                </div>
                <ChevronDown className="text-muted-foreground size-4 shrink-0" />
              </Button>
            }
          />
          <DropdownMenuContent side="top" align="start" className="min-w-[14rem]">
            <DropdownMenuItem
              className="cursor-pointer"
              render={<Link href="/dashboard/settings#account" onClick={closeMobileNav} />}
            >
              <UserPen className="size-4" />
              {tShell("editAccount")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void signOut({ callbackUrl: loginCallback })}>
              <LogOut className="size-4" />
              {tShell("signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

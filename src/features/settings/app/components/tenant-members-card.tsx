"use client";

import { KeyRound, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { ManualSetPasswordDialog } from "@/features/settings/app/components/manual-set-password-dialog";
import { TeamMemberRemoveDialog } from "@/features/settings/app/components/team-member-remove-dialog";
import { getTenantClinicSettings } from "@/features/settings/app/services/tenant-settings.service";
import { useTenantMembers } from "@/features/settings/app/hooks/use-tenant-members";
import type { TenantMemberRow } from "@/features/settings/app/types/account";
import { toast } from "@/lib/toast";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";

export function TenantMembersCard() {
  const t = useTranslations("settings.members");
  const { data: session } = useSession();
  const [memberToRemove, setMemberToRemove] = useState<TenantMemberRow | null>(null);
  const [memberToSetPassword, setMemberToSetPassword] = useState<TenantMemberRow | null>(null);
  const [tenantNameFromApi, setTenantNameFromApi] = useState<string | null>(null);
  const {
    sessionStatus,
    currentUserId,
    tenantId,
    canManage,
    rows,
    sortedRows,
    error,
    busyId,
    reload,
    updateMemberRole,
    deleteMember,
  } = useTenantMembers();

  useEffect(() => {
    const fromSession = session?.user?.tenantName?.trim();
    if (fromSession) {
      setTenantNameFromApi(null);
      return;
    }
    if (sessionStatus !== "authenticated" || !canManage || !tenantId) {
      return;
    }
    let cancelled = false;
    void getTenantClinicSettings({ skipErrorToast: true })
      .then((data) => {
        const name = data.tenant.name?.trim();
        if (!cancelled && name) setTenantNameFromApi(name);
      })
      .catch(() => {
        if (!cancelled) setTenantNameFromApi(null);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.tenantName, sessionStatus, canManage, tenantId]);

  const tenantName =
    session?.user?.tenantName?.trim() || tenantNameFromApi || "—";

  async function handleRoleChange(memberUserId: string, value: string) {
    const member = sortedRows.find((row) => row.userId === memberUserId);
    if (!member) return;
    const nextRole = value === "tenant_admin" ? "tenant_admin" : "tenant_user";
    try {
      await updateMemberRole(member, nextRole);
      toast.success(t("roleUpdated"));
    } catch {
      await reload();
    }
  }

  function openRemoveDialog(memberUserId: string) {
    const member = sortedRows.find((row) => row.userId === memberUserId);
    if (!member) return;
    setMemberToRemove(member);
  }

  function openSetPasswordDialog(memberUserId: string) {
    const member = sortedRows.find((row) => row.userId === memberUserId);
    if (!member) return;
    setMemberToSetPassword(member);
  }

  async function handleConfirmRemove() {
    if (!memberToRemove) return;
    try {
      await deleteMember(memberToRemove);
      toast.success(t("memberRemoved"));
    } catch (e) {
      await reload();
      throw e;
    }
  }

  if (sessionStatus === "loading") {
    return null;
  }

  if (!canManage || !tenantId) {
    return null;
  }

  if (rows === null && !error) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description", { tenantName })}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-destructive text-sm">{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw className="size-4" />
            {t("retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <TeamMemberRemoveDialog
        open={memberToRemove !== null}
        onOpenChange={(open) => {
          if (!open) setMemberToRemove(null);
        }}
        member={memberToRemove}
        busy={memberToRemove !== null && busyId === memberToRemove.userId}
        onConfirm={handleConfirmRemove}
      />
      {memberToSetPassword && tenantId ? (
        <ManualSetPasswordDialog
          open={memberToSetPassword !== null}
          onOpenChange={(open) => {
            if (!open) setMemberToSetPassword(null);
          }}
          userId={memberToSetPassword.userId}
          tenantId={tenantId}
          email={memberToSetPassword.email}
          name={memberToSetPassword.name}
          hasExistingPassword={memberToSetPassword.hasPassword}
          onSuccess={() => void reload()}
        />
      ) : null}
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description", { tenantName })}</CardDescription>
      </CardHeader>
      <CardContent>
        {!sortedRows.length ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : (
          <div className="divide-border rounded-xl border">
            <div className="text-muted-foreground grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b px-3 py-2 text-xs font-medium sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto]">
              <span>{t("columns.member")}</span>
              <span className="hidden sm:inline">{t("columns.email")}</span>
              <span className="text-center sm:text-left">{t("columns.role")}</span>
              <span className="w-10 text-right sm:w-12" />
            </div>
            <ul className="divide-y">
              {sortedRows.map((member) => {
                const isSelf = currentUserId === member.userId;
                const busy = busyId === member.userId;
                return (
                  <li
                    key={member.userId}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-3 text-sm sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto]"
                  >
                    <div className="min-w-0">
                      <span className="font-medium">{member.name?.trim() || member.email}</span>
                      {isSelf ? (
                        <span className="text-muted-foreground ml-2 text-xs">({t("you")})</span>
                      ) : null}
                      <div className="text-muted-foreground truncate text-xs sm:hidden">{member.email}</div>
                    </div>
                    <span className="text-muted-foreground hidden truncate sm:inline">{member.email}</span>
                    <Select
                      value={member.role}
                      onValueChange={(value) => {
                        if (value) void handleRoleChange(member.userId, value);
                      }}
                      disabled={busy}
                    >
                      <SelectTrigger className="h-9 w-[140px] sm:w-[160px]" size="sm">
                        <SelectValue>
                          {member.role === "tenant_admin" ? t("roleAdmin") : t("roleUser")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tenant_admin">{t("roleAdmin")}</SelectItem>
                        <SelectItem value="tenant_user">{t("roleUser")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center justify-end gap-1">
                      {!isSelf ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={busy}
                          onClick={() => openSetPasswordDialog(member.userId)}
                          aria-label={member.hasPassword ? t("resetPassword") : t("setPassword")}
                        >
                          <KeyRound className="size-4" />
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        disabled={busy}
                        onClick={() => openRemoveDialog(member.userId)}
                        aria-label={t("remove")}
                      >
                        {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

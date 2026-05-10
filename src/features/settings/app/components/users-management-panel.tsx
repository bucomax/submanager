"use client";

import { TeamInviteUserDialog } from "@/features/settings/app/components/team-invite-user-dialog";
import { TenantMembersCard } from "@/features/settings/app/components/tenant-members-card";
import { Button } from "@/shared/components/ui/button";
import { Plus } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function UsersManagementPanel() {
  const t = useTranslations("settings");
  const { data: session, status } = useSession();
  const canManage =
    session?.user?.tenantRole === "tenant_admin" || session?.user?.globalRole === "super_admin";
  const [inviteOpen, setInviteOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  if (status === "loading") {
    return null;
  }
  if (!canManage) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setInviteOpen(true)}>
          <Plus className="size-4" />
          {t("addUser")}
        </Button>
      </div>
      <TeamInviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={() => setReloadKey((k) => k + 1)}
      />
      <TenantMembersCard key={reloadKey} />
    </div>
  );
}

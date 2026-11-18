"use client";

import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useTenantSwitcher } from "@/shared/hooks/use-tenant-switcher";
import { Building2, Check, ChevronsUpDown, Loader2 } from "lucide-react";

type TenantSwitcherProps = {
  activeTenantId: string | null | undefined;
};

export function TenantSwitcher({ activeTenantId }: TenantSwitcherProps) {
  const { tenants, loadError, pendingId, selectTenant } = useTenantSwitcher(activeTenantId);

  const current = tenants?.find((t) => t.id === activeTenantId) ?? null;
  const label = current?.name ?? (activeTenantId ? "Tenant selecionado" : "Sem tenant");

  if (tenants && tenants.length === 0 && !loadError) {
    return (
      <span className="text-muted-foreground hidden max-w-[12rem] truncate text-sm sm:inline">
        Nenhum tenant
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="max-w-[14rem] justify-between gap-1 px-2"
            disabled={!!pendingId || tenants === null}
          >
            {pendingId !== null ? (
              <Loader2 className="size-4 shrink-0 animate-spin" />
            ) : (
              <Building2 className="size-4 shrink-0" />
            )}
            <span className="truncate">{tenants === null ? "…" : label}</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <DropdownMenuContent className="min-w-[14rem]" align="end">
        {loadError ? (
          <div className="text-destructive px-2 py-1.5 text-sm">{loadError}</div>
        ) : null}
        {tenants?.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => void selectTenant(t.id)}
            disabled={!!pendingId}
          >
            <span className="flex flex-1 flex-col gap-0.5 truncate text-left">
              <span className="truncate font-medium">{t.name}</span>
              <span className="text-muted-foreground text-xs">{t.slug}</span>
            </span>
            {t.id === activeTenantId ? (
              <Check className="text-primary ml-2 size-4 shrink-0" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

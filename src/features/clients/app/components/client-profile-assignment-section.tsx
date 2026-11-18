"use client";

import { useCreateOpmeSupplier } from "@/features/settings/app/hooks/use-create-opme-supplier";
import { useTenantSettingsPickers } from "@/features/settings/app/hooks/use-tenant-settings-pickers";
import type { ClientProfileSectionProps } from "@/features/clients/app/types/client-profile";
import { NONE } from "@/features/clients/app/utils/client-profile-form";
import { toast } from "@/lib/toast";
import { Button } from "@/shared/components/ui/button";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** Responsável interno e fornecedor OPME (somente equipe). */
export function ClientProfileAssignmentSection({
  draft,
  setField,
  saving,
}: Pick<ClientProfileSectionProps, "draft" | "setField" | "saving">) {
  const t = useTranslations("clients.detail.profile");
  const { data: session, status: sessionStatus } = useSession();
  const tenantId = session?.user?.tenantId ?? null;
  const { creating, submitCreateOpmeSupplier } = useCreateOpmeSupplier();
  const { members, suppliers, appendSupplier } = useTenantSettingsPickers({
    enabled: Boolean(tenantId),
    fallbackErrorMessage: t("saveError"),
  });
  const canCreateOpme =
    session?.user?.tenantRole === "tenant_admin" || session?.user?.globalRole === "super_admin";
  const [newOpmeName, setNewOpmeName] = useState("");

  async function handleCreateOpme() {
    const n = newOpmeName.trim();
    if (!n) return;
    try {
      const { supplier } = await submitCreateOpmeSupplier(n);
      setNewOpmeName("");
      appendSupplier({ id: supplier.id, name: supplier.name });
      setField("opme", supplier.id);
      toast.success(t("opmeCreated"));
    } catch {
      /* erro: toast global no apiClient */
    }
  }

  return (
    <>
    <Field>
      <FieldLabel>{t("assignedTo")}</FieldLabel>
      <Select
        value={draft.assigned}
        onValueChange={(v) => setField("assigned", v ?? NONE)}
        disabled={saving || sessionStatus !== "authenticated" || members === null}
      >
        <SelectTrigger className="w-full min-w-0">
          <SelectValue placeholder={t("assignedPlaceholder")}>
            {(value) => {
              if (value === NONE || value == null) return t("none");
              const m = members?.find((x) => x.userId === value);
              return m ? (m.name ?? m.email) : String(value);
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t("none")}</SelectItem>
          {(members ?? []).map((m) => (
            <SelectItem key={m.userId} value={m.userId}>
              {m.name ?? m.email}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
    <Field>
      <FieldLabel>{t("opme")}</FieldLabel>
      <Select
        value={draft.opme}
        onValueChange={(v) => setField("opme", v ?? NONE)}
        disabled={saving || sessionStatus !== "authenticated" || suppliers === null}
      >
        <SelectTrigger className="w-full min-w-0">
          <SelectValue placeholder={t("opmePlaceholder")}>
            {(value) => {
              if (value === NONE || value == null) return t("none");
              const s = suppliers?.find((x) => x.id === value);
              return s ? s.name : String(value);
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t("none")}</SelectItem>
          {(suppliers ?? []).map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {canCreateOpme ? (
        <div className="mt-2 flex w-full min-w-0 flex-wrap gap-2">
          <Input
            value={newOpmeName}
            onChange={(e) => setNewOpmeName(e.target.value)}
            placeholder={t("newOpmePlaceholder")}
            disabled={creating}
            className="min-w-[12rem] flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={creating || !newOpmeName.trim()}
            onClick={() => void handleCreateOpme()}
          >
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {t("newOpme")}
          </Button>
        </div>
      ) : null}
    </Field>
    </>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import { toast } from "@/lib/toast";
import { Button } from "@/shared/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { useSyncedDraft } from "@/shared/hooks/use-synced-draft";
import type { TenantEmailDomainDto } from "@/types/api/email-domain-v1";

type EmailVerifiedSenderPanelProps = {
  emailDomain: TenantEmailDomainDto;
  busy: boolean;
  patch: (input: { emailEnabled?: boolean; fromName?: string; fromAddress?: string }) => Promise<void>;
};

/** Domínio verificado: liga/desliga o envio com o domínio próprio e edita remetente (nome + endereço). */
export function EmailVerifiedSenderPanel({ emailDomain: ed, busy, patch }: EmailVerifiedSenderPanelProps) {
  const t = useTranslations("settings.email");

  const serverSender = useMemo(
    () => ({ address: ed.fromAddress ?? "", name: ed.fromName ?? "" }),
    [ed.fromAddress, ed.fromName],
  );
  const [sender, setSender] = useSyncedDraft(serverSender);
  const draftFrom = sender.address;
  const draftName = sender.name;
  const setDraftFrom = (value: string) => setSender((prev) => ({ ...prev, address: value }));
  const setDraftName = (value: string) => setSender((prev) => ({ ...prev, name: value }));

  const onSaveSender = useCallback(async () => {
    const name = draftName.trim();
    const addr = draftFrom.trim();
    const p: { fromName?: string; fromAddress?: string } = {};
    if (name !== (ed.fromName ?? "").trim()) p.fromName = name;
    if (addr !== (ed.fromAddress ?? "").trim()) p.fromAddress = addr;
    if (Object.keys(p).length === 0) return;
    try {
      await patch(p);
      toast.success(t("saveSuccess"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("loadError"));
    }
  }, [draftFrom, draftName, ed.fromAddress, ed.fromName, patch, t]);

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{t("enableCustom")}</p>
          <p className="text-muted-foreground text-xs">
            {ed.fromAddress} — {ed.fromName}
          </p>
        </div>
        <Switch
          checked={ed.emailEnabled}
          onCheckedChange={(v) => {
            void (async () => {
              try {
                await patch({ emailEnabled: v });
                toast.success(t("saveSuccess"));
              } catch (e) {
                toast.error(e instanceof Error ? e.message : t("loadError"));
              }
            })();
          }}
          disabled={busy}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel>{t("fromNameLabel")}</FieldLabel>
          <FieldContent>
            <Input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder={t("fromNamePlaceholder")}
            />
          </FieldContent>
        </Field>
        <Field>
          <FieldLabel>{t("fromAddressLabel")}</FieldLabel>
          <FieldContent>
            <Input
              type="email"
              value={draftFrom}
              onChange={(e) => setDraftFrom(e.target.value)}
            />
          </FieldContent>
          <FieldDescription>{t("localPartHint")}</FieldDescription>
        </Field>
      </div>
      <Button type="button" size="sm" onClick={() => void onSaveSender()} disabled={busy}>
        {t("saveSender")}
      </Button>
    </div>
  );
}

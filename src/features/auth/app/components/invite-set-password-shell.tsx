"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import type { InviteSetPasswordPreviewDto } from "../types/api";
import { useInvitePreview } from "../hooks/use-invite-preview";
import { SetPasswordForm } from "./set-password-form";

type InviteSetPasswordShellProps = {
  successMessage: string;
};

function InvitePreviewCard({ preview }: { preview: InviteSetPasswordPreviewDto }) {
  const t = useTranslations("auth.setPassword");
  const displayName = preview.userName?.trim() || preview.userEmail;

  return (
    <div className="bg-muted/40 border-border mb-4 rounded-lg border px-4 py-3 text-sm">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{t("previewTitle")}</p>
      <p className="text-foreground mt-1 font-semibold">{displayName}</p>
      {preview.userName?.trim() ? (
        <p className="text-muted-foreground text-xs">{preview.userEmail}</p>
      ) : null}
      <div className="mt-3 space-y-1">
        <p>
          <span className="text-muted-foreground">{t("previewClinic")}: </span>
          <span className="text-foreground">{preview.tenantName}</span>
        </p>
        {preview.tenantTaxIdDisplay ? (
          <p>
            <span className="text-muted-foreground">{t("previewTaxId")}: </span>
            <span className="text-foreground tabular-nums">{preview.tenantTaxIdDisplay}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function InviteSetPasswordShell({ successMessage }: InviteSetPasswordShellProps) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const preview = useInvitePreview(token);

  return (
    <>
      {preview ? <InvitePreviewCard preview={preview} /> : null}
      <SetPasswordForm successMessage={successMessage} />
    </>
  );
}

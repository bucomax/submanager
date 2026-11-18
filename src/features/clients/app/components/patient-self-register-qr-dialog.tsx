"use client";

import { useSelfRegisterInviteDialog } from "@/features/clients/app/hooks/use-self-register-invite-dialog";
import { formatDateTimeShort } from "@/lib/utils/date";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Dialog, StandardDialogContent } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { toast } from "@/lib/toast";
import { Copy, MessageCircle, QrCode, Share2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import QRCode from "react-qr-code";

export type PatientSelfRegisterQrDialogProps = {
  /** Convite amarrado a um paciente já existente (atualiza cadastro ao usar o link). */
  clientId?: string;
  /** Rótulo do botão que abre o diálogo. */
  triggerLabel?: string;
  buttonVariant?: "outline" | "secondary" | "ghost";
  triggerClassName?: string;
};

export function PatientSelfRegisterQrDialog({
  clientId,
  triggerLabel,
  buttonVariant = "outline",
  triggerClassName,
}: PatientSelfRegisterQrDialogProps) {
  const t = useTranslations("clients.selfRegister");
  const tList = useTranslations("clients.list");
  const locale = useLocale();
  const {
    open,
    openDialog: handleOpen,
    onOpenChange,
    loading,
    failed,
    url: registerUrl,
    expiresAt,
  } = useSelfRegisterInviteDialog(clientId);
  const error = failed ? t("loadError") : null;

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const expiryLabel =
    expiresAt != null
      ? formatDateTimeShort(expiresAt, locale === "en" ? "en-US" : "pt-BR")
      : null;

  async function copyLink() {
    if (!registerUrl) return;
    try {
      await navigator.clipboard.writeText(registerUrl);
      toast.success(t("copied"));
    } catch {
      toast.error(t("loadError"));
    }
  }

  async function shareNative() {
    if (!registerUrl || !navigator.share) return;
    const text = t("shareMessagePlain", { url: registerUrl });
    try {
      await navigator.share({
        title: t("shareTitle"),
        text,
        url: registerUrl,
      });
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      if (name === "AbortError") return;
      toast.error(t("loadError"));
    }
  }

  function openWhatsAppShare() {
    if (!registerUrl) return;
    const text = encodeURIComponent(t("shareMessagePlain", { url: registerUrl }));
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  const label = triggerLabel ?? tList("selfRegisterQr");
  const title = clientId ? t("dialogTitleForPatient") : t("dialogTitle");
  const description = clientId ? t("dialogDescriptionForPatient") : t("dialogDescription");

  return (
    <>
      <Button
        type="button"
        variant={buttonVariant}
        size="sm"
        className={cn(triggerClassName)}
        onClick={handleOpen}
      >
        <QrCode className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 truncate text-left">{label}</span>
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <StandardDialogContent
          title={title}
          description={description}
          size="default"
          bodyClassName="space-y-4"
        >
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="mx-auto size-[200px] rounded-lg" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {!loading && registerUrl ? (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-xl border bg-white p-3">
                <QRCode value={registerUrl} size={200} level="M" />
              </div>
              {expiryLabel ? (
                <p className="text-muted-foreground text-center text-xs">{t("expiryHint", { date: expiryLabel })}</p>
              ) : null}
              <div className="w-full space-y-2">
                <p className="text-muted-foreground text-xs font-medium">{t("linkLabel")}</p>
                <div className="flex gap-2">
                  <Input readOnly value={registerUrl} className="min-w-0 font-mono text-xs" />
                  <Button type="button" variant="secondary" size="icon" onClick={() => void copyLink()}>
                    <Copy className="size-4" />
                    <span className="sr-only">{t("copyLink")}</span>
                  </Button>
                </div>
              </div>
              <div className="flex w-full flex-wrap justify-center gap-2">
                {canNativeShare ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => void shareNative()}>
                    <Share2 className="size-4" />
                    {t("shareNative")}
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="sm" onClick={openWhatsAppShare}>
                  <MessageCircle className="size-4" />
                  {t("shareWhatsApp")}
                </Button>
              </div>
            </div>
          ) : null}
        </StandardDialogContent>
      </Dialog>
    </>
  );
}

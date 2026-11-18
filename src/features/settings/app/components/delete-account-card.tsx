"use client";

import { useDeleteAccount } from "@/features/settings/app/hooks/use-delete-account";
import { toast } from "@/lib/toast";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Dialog, StandardDialogContent } from "@/shared/components/ui/dialog";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

const LOGIN_CALLBACK = "/login";

export function DeleteAccountCard() {
  const t = useTranslations("settings.danger");
  const { deleteCurrentAccount } = useDeleteAccount();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);

  const expectedWord = t("confirmWord");
  const matches = confirmText.trim().toLowerCase() === expectedWord.trim().toLowerCase();

  /** Fechar sempre zera o formulário de confirmação. */
  function changeDialogOpen(next: boolean) {
    setDialogOpen(next);
    if (!next) {
      setConfirmText("");
      setPending(false);
    }
  }

  function handleDialogOpenChange(next: boolean) {
    if (pending && !next) return;
    changeDialogOpen(next);
  }

  async function handleConfirm() {
    if (!matches || pending) return;
    setPending(true);
    try {
      await deleteCurrentAccount();
      toast.success(t("success"));
      changeDialogOpen(false);
      await signOut({ callbackUrl: LOGIN_CALLBACK });
    } catch {
      toast.error(t("genericError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Card className="border-destructive/35 bg-destructive-soft text-foreground shadow-sm dark:border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{t("cardHint")}</p>
        </CardContent>
        <CardFooter className="mt-6 border-destructive/25 border-t bg-transparent pt-4 dark:bg-transparent">
          <Button type="button" variant="destructive" onClick={() => setDialogOpen(true)}>
            <Trash2 className="size-4" />
            {t("openConfirm")}
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <StandardDialogContent
          size="default"
          showCloseButton={!pending}
          title={t("dialogTitle")}
          description={t("dialogDescription")}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                disabled={pending}
                onClick={() => changeDialogOpen(false)}
              >
                <X className="size-4 shrink-0" aria-hidden />
                {t("cancel")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="gap-2"
                disabled={!matches || pending}
                onClick={() => void handleConfirm()}
              >
                {pending ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="size-4 shrink-0" aria-hidden />
                )}
                {pending ? t("deleting") : t("confirm")}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="size-4" aria-hidden />
              <AlertTitle className="text-sm font-medium">{t("dialogAlertTitle")}</AlertTitle>
              <AlertDescription className="text-sm">{t("dialogAlertBody")}</AlertDescription>
            </Alert>
            <Field>
              <FieldLabel htmlFor="settings-delete-account-confirm">{t("typeWordLabel", { word: expectedWord })}</FieldLabel>
              <Input
                id="settings-delete-account-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                disabled={pending}
                placeholder={expectedWord}
              />
            </Field>
          </div>
        </StandardDialogContent>
      </Dialog>
    </>
  );
}

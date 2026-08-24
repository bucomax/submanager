"use client";

import { useTranslations } from "next-intl";
import { Form, FormTextarea } from "@/shared/components/forms";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Dialog, StandardDialogContent } from "@/shared/components/ui/dialog";
import { useFeedbackForm } from "@/features/feedback/app/hooks/use-feedback-form";
import { useFeedbackDialogStore } from "@/features/feedback/app/hooks/use-feedback-dialog-store";
import type { FeedbackFormValues } from "@/features/feedback/app/utils/feedback-schema";

const TYPE_OPTIONS: {
  value: FeedbackFormValues["type"];
  labelKey: "typeBug" | "typeSuggestion" | "typeQuestion";
}[] = [
  { value: "bug", labelKey: "typeBug" },
  { value: "suggestion", labelKey: "typeSuggestion" },
  { value: "question", labelKey: "typeQuestion" },
];

/**
 * Sem props: lê a store global do dialog. Precisa funcionar tanto montado pelo
 * `FeedbackLauncher` (sidebar) quanto pela tela de erro, que não tem sidebar.
 */
export function FeedbackDialog() {
  const t = useTranslations("feedback.widget");
  const open = useFeedbackDialogStore((s) => s.open);
  const closeDialog = useFeedbackDialogStore((s) => s.closeDialog);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeDialog()}>
      {open ? (
        <StandardDialogContent title={t("title")} description={t("description")}>
          {/* Componente próprio: monta de novo a cada abertura para o `useForm`
              capturar `defaultValues` a partir do estado atual da store (tipo
              forçado e erro anexado), em vez de congelar no primeiro render. */}
          <FeedbackForm onDone={closeDialog} />
        </StandardDialogContent>
      ) : null}
    </Dialog>
  );
}

function FeedbackForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations("feedback.widget");
  const { form, onValid, attachedError } = useFeedbackForm(onDone);
  const selectedType = form.watch("type");
  const attach = form.watch("attachTechnicalDetails");

  return (
    <Form {...form}>
      <form
        id="feedback-form"
        onSubmit={form.handleSubmit(onValid)}
        className="flex flex-col gap-4 p-4"
      >
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t("typeLabel")}</span>
          <div className="flex gap-2">
            {TYPE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={selectedType === option.value ? "default" : "outline"}
                onClick={() => form.setValue("type", option.value)}
              >
                {t(option.labelKey)}
              </Button>
            ))}
          </div>
        </div>

        <FormTextarea
          name="message"
          label={t("messageLabel")}
          placeholder={t("messagePlaceholder")}
          rows={5}
        />

        {attachedError ? (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={attach}
              onChange={(e) => form.setValue("attachTechnicalDetails", e.target.checked)}
            />
            <span className="flex flex-col gap-1">
              <span className="flex items-center gap-2">
                {t("attachLabel")}
                {attachedError.sentryEventId ? (
                  <Badge variant="outline" className="font-mono text-xs">
                    {attachedError.sentryEventId.slice(0, 8)}
                  </Badge>
                ) : null}
              </span>
              <span className="text-muted-foreground text-xs">{t("attachHint")}</span>
            </span>
          </label>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onDone}>
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {t("submit")}
          </Button>
        </div>
      </form>
    </Form>
  );
}

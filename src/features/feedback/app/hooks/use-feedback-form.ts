"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { createFeedback } from "@/features/feedback/app/services/feedback.service";
import {
  createFeedbackFormSchema,
  type FeedbackFormValues,
} from "@/features/feedback/app/utils/feedback-schema";
import { useFeedbackDialogStore } from "@/features/feedback/app/hooks/use-feedback-dialog-store";
import { useLastErrorStore } from "@/shared/stores/use-last-error-store";

/**
 * `forcedType`/`attachedError` vêm da store do dialog (congelados na abertura),
 * não de `readFreshError` chamado aqui: este hook é reinstanciado a cada vez que
 * o dialog monta (ver `FeedbackDialog`), então os valores já chegam corretos.
 */
export function useFeedbackForm(onDone: () => void) {
  const t = useTranslations("feedback.widget");
  const locale = useLocale();
  const forcedType = useFeedbackDialogStore((s) => s.forcedType);
  const attachedError = useFeedbackDialogStore((s) => s.attachedError);
  const clearLastError = useLastErrorStore((s) => s.clearLastError);

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(createFeedbackFormSchema(t)),
    defaultValues: {
      type: forcedType === "other" ? "question" : (forcedType ?? (attachedError ? "bug" : "suggestion")),
      message: "",
      attachTechnicalDetails: attachedError !== null,
    },
  });

  async function onValid(values: FeedbackFormValues) {
    const errorToAttach = values.attachTechnicalDetails ? attachedError : null;
    try {
      await createFeedback(
        {
          type: values.type,
          message: values.message,
          sentryEventId: errorToAttach?.sentryEventId ?? null,
          requestId: errorToAttach?.requestId ?? null,
          pagePath: window.location.pathname,
          locale,
        },
        t("success"),
      );
    } catch {
      // erro: toast global no apiClient — sem duplicar aqui, form permanece aberto.
      return;
    }
    if (errorToAttach) clearLastError();
    form.reset();
    onDone();
  }

  return { form, onValid, attachedError };
}

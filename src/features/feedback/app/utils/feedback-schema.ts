import { z } from "zod";

/** Chaves de `feedback.widget` usadas nas mensagens de validação do formulário. */
type FeedbackSchemaMessageKey = "messageTooShort" | "messageTooLong";

/**
 * Fábrica em vez de schema estático: as mensagens de `message` precisam do
 * namespace `feedback.widget` (i18n obrigatório), que só existe dentro de um
 * componente/hook via `useTranslations`. O parâmetro fica restrito às chaves
 * usadas aqui para aceitar o `t` tipado do next-intl (que só aceita chaves
 * conhecidas do namespace, não qualquer `string`).
 */
export function createFeedbackFormSchema(t: (key: FeedbackSchemaMessageKey) => string) {
  return z.object({
    type: z.enum(["bug", "suggestion", "question"]),
    message: z.string().trim().min(10, t("messageTooShort")).max(2000, t("messageTooLong")),
    attachTechnicalDetails: z.boolean(),
  });
}

export type FeedbackFormValues = z.infer<ReturnType<typeof createFeedbackFormSchema>>;

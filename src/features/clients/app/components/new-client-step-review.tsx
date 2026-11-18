"use client";

import type { PathwayOption } from "@/features/clients/app/types/api";
import type { NewClientFormValues } from "@/features/clients/app/utils/schemas";
import { formatCepDisplay } from "@/lib/validators/cep";
import { formatCpfDisplay } from "@/lib/validators/cpf";
import { formatPhoneBrDisplay } from "@/lib/validators/phone";
import { useTranslations } from "next-intl";
import { useFormContext } from "react-hook-form";

type NewClientReviewStepProps = {
  selectedPathway: PathwayOption | null;
};

/** Etapa 3: revisão dos dados antes de criar paciente + jornada. */
export function NewClientReviewStep({ selectedPathway }: NewClientReviewStepProps) {
  const t = useTranslations("clients.wizard");
  const form = useFormContext<NewClientFormValues>();
  const reviewPhone = String(form.getValues("phone") ?? "");
  const reviewDocumentId = String(form.getValues("documentId") ?? "");
  const reviewIsMinor = Boolean(form.getValues("isMinor"));
  const reviewPostal = String(form.getValues("postalCode") ?? "");

  return (
      <div className="space-y-3 text-sm">
        <p className="font-medium">{t("reviewTitle")}</p>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t("reviewName")}</dt>
            <dd>{form.getValues("name")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("reviewPhone")}</dt>
            <dd>{formatPhoneBrDisplay(reviewPhone)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("email")}</dt>
            <dd>{String(form.getValues("email") ?? "").trim() || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {reviewIsMinor ? t("documentIdMinor") : t("documentId")}
            </dt>
            <dd>{reviewDocumentId ? formatCpfDisplay(reviewDocumentId) : "—"}</dd>
          </div>
          {reviewIsMinor ? (
            <>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">{t("guardianSection")}</dt>
                <dd>
                  {String(form.getValues("guardianName") ?? "").trim() || "—"} ·{" "}
                  {String(form.getValues("guardianDocumentId") ?? "").trim()
                    ? formatCpfDisplay(String(form.getValues("guardianDocumentId")))
                    : "—"}
                </dd>
              </div>
            </>
          ) : null}
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">{t("addressSection")}</dt>
            <dd className="space-y-0.5">
              <span className="block">
                {reviewPostal ? formatCepDisplay(reviewPostal) : "—"}
                {String(form.getValues("addressLine") ?? "").trim()
                  ? ` · ${String(form.getValues("addressLine")).trim()}`
                  : ""}
                {String(form.getValues("addressNumber") ?? "").trim()
                  ? `, ${String(form.getValues("addressNumber")).trim()}`
                  : ""}
              </span>
              {String(form.getValues("addressComp") ?? "").trim() ? (
                <span className="text-muted-foreground block text-xs">
                  {String(form.getValues("addressComp")).trim()}
                </span>
              ) : null}
              <span className="block">
                {[
                  String(form.getValues("neighborhood") ?? "").trim(),
                  String(form.getValues("city") ?? "").trim(),
                  String(form.getValues("state") ?? "").trim().toUpperCase(),
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </span>
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">{t("reviewPathway")}</dt>
            <dd>{selectedPathway?.name ?? "—"}</dd>
          </div>
          {selectedPathway?.publishedVersion ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">{t("reviewVersion")}</dt>
              <dd>v{selectedPathway.publishedVersion.version}</dd>
            </div>
          ) : null}
        </dl>
      </div>
  );
}

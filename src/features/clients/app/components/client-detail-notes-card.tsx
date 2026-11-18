"use client";

import { ClientDetailCardTitle } from "@/features/clients/app/components/client-detail-card-title";
import { useCreateClientNote } from "@/features/clients/app/hooks/use-create-client-note";
import { useClientNotes } from "@/features/clients/app/hooks/use-client-notes";
import { toast } from "@/lib/toast";
import { formatListUpdatedAt } from "@/lib/utils/format-list-updated-at";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/shared/components/ui/card";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Save, StickyNote } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

type ClientDetailNotesCardProps = {
  clientId: string;
};

export function ClientDetailNotesCard({ clientId }: ClientDetailNotesCardProps) {
  const t = useTranslations("clients.detail.notes");
  const locale = useLocale();
  const { data, error, loading, page, setPage, reload, limit } = useClientNotes(clientId);
  const { creating: saving, createNote } = useCreateClientNote();
  const [draft, setDraft] = useState("");

  const noteDirty = draft.trim().length > 0;
  const pagination = data?.pagination;
  const from =
    pagination && pagination.totalItems > 0 ? (page - 1) * limit + 1 : 0;
  const to =
    pagination && pagination.totalItems > 0 ? Math.min(page * limit, pagination.totalItems) : 0;

  const saveDisabled = useMemo(() => saving || !noteDirty, [saving, noteDirty]);

  const totalItems = pagination?.totalItems ?? 0;
  const showEmptyState = !loading && data && totalItems === 0;
  const showList = !loading && data && totalItems > 0;

  async function handleCreateNote() {
    const content = draft.trim();
    if (!content) return;

    try {
      await createNote(clientId, content);
      setDraft("");
      toast.success(t("saved"));
      if (page !== 1) setPage(1);
    } catch {
      /* erro: toast global no apiClient */
    }
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <ClientDetailCardTitle icon={StickyNote}>{t("title")}</ClientDetailCardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="border-border/70 bg-muted/10 space-y-3 rounded-xl border p-3">
          <Field>
            <FieldLabel htmlFor="client-detail-note-content">{t("label")}</FieldLabel>
            <textarea
              id="client-detail-note-content"
              rows={4}
              maxLength={10_000}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={saving}
              className={cn(
                "border-input bg-background/60 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-[4.5rem] w-full rounded-lg border px-2.5 py-2 text-base transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/25",
              )}
              placeholder={t("placeholder")}
            />
          </Field>
          <Button type="button" size="sm" disabled={saveDisabled} onClick={() => void handleCreateNote()}>
            {saving ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4 shrink-0" aria-hidden />
            )}
            {saving ? t("saving") : t("save")}
          </Button>
        </div>

        {error ? (
          <div className="border-destructive/30 bg-destructive/5 space-y-2 rounded-xl border p-3">
            <p className="text-destructive text-sm">{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
              <RefreshCw className="size-4" aria-hidden />
              {t("retry")}
            </Button>
          </div>
        ) : null}

        {loading ? (
          <div className="border-border/70 overflow-hidden rounded-xl border">
            <div className="divide-border divide-y">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="bg-muted/5 px-3 py-3 sm:px-4">
                  <div className="bg-muted h-3.5 w-32 max-w-[40%] rounded" />
                  <div className="bg-muted mt-2.5 h-3 w-full rounded" />
                  <div className="bg-muted mt-2 h-3 w-4/5 max-w-md rounded" />
                  <div className="bg-muted mt-3 h-2.5 w-40 rounded opacity-80" />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {showEmptyState ? (
          <div className="border-border/60 text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/[0.07] px-5 py-12 text-center text-sm">
            <StickyNote className="text-muted-foreground/45 size-9 stroke-[1.25]" aria-hidden />
            <p className="text-foreground/90 max-w-sm leading-snug">{t("empty")}</p>
          </div>
        ) : null}

        {showList ? (
          <div className="space-y-3">
            {totalItems > limit || (pagination && pagination.totalPages > 1) ? (
              <p className="text-muted-foreground px-0.5 text-xs tabular-nums">
                {t("range", { from, to, total: pagination!.totalItems })}
              </p>
            ) : null}

            {data!.data.length > 0 ? (
              <ul className="border-border/70 divide-border divide-y overflow-hidden rounded-xl border bg-muted/10">
                {data!.data.map((note) => (
                  <li key={note.id} className="px-3 py-3 sm:px-4">
                    <p className="text-foreground/95 text-sm leading-relaxed whitespace-pre-wrap">{note.content}</p>
                    <p className="text-muted-foreground mt-2.5 text-xs tabular-nums">
                      {t("byline", {
                        author: note.author.name ?? note.author.email,
                        date: formatListUpdatedAt(note.createdAt, locale),
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground px-0.5 text-sm">{t("noRows")}</p>
            )}

            {pagination && pagination.totalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bg-background/80"
                  disabled={!pagination.hasPreviousPage || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  {t("prev")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bg-background/80"
                  disabled={!pagination.hasNextPage || loading}
                  onClick={() => setPage((current) => current + 1)}
                >
                  {t("next")}
                  <ChevronRight className="size-4" aria-hidden />
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

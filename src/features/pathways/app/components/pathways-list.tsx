"use client";

import { useCreatePathway } from "@/features/pathways/app/hooks/use-create-pathway";
import { usePathways } from "@/features/pathways/app/hooks/use-pathways";
import { useCanManagePathways } from "@/shared/hooks/use-can-manage-pathways";
import { Link, useRouter } from "@/i18n/navigation";
import { toast } from "@/lib/toast";
import {
  DataTableBody,
  DataTableEmpty,
  DataTableHeader,
  DataTableRoot,
  DataTableRow,
  DataTableScroll,
} from "@/shared/components/layout/data-table";
import { Button } from "@/shared/components/ui/button";
import { Dialog, StandardDialogContent } from "@/shared/components/ui/dialog";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Check, ExternalLink, Loader2, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

const ROW_GRID =
  "grid min-w-[360px] grid-cols-[minmax(8rem,1fr)_minmax(7rem,auto)] items-center gap-2";

const REDIRECT_DELAY_MS = 5_000;

type CreateDialogPhase = "idle" | "saving" | "redirecting";

export function PathwaysList() {
  const t = useTranslations("pathways.list");
  const router = useRouter();
  const { pathways, loading, error, reload } = usePathways();
  const { canManage } = useCanManagePathways();
  const { createPathway } = useCreatePathway();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [createPhase, setCreatePhase] = useState<CreateDialogPhase>("idle");

  const isCreateBusy = createPhase !== "idle";

  const onDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && isCreateBusy) return;
      setDialogOpen(open);
      if (!open) {
        setName("");
        setCreatePhase("idle");
      }
    },
    [isCreateBusy],
  );

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error(t("nameRequired"));
      return;
    }
    if (isCreateBusy) return;

    setCreatePhase("saving");
    try {
      const pathway = await createPathway({ name: trimmed });
      toast.success(t("createSuccess"));
      setCreatePhase("redirecting");
      await new Promise((resolve) => setTimeout(resolve, REDIRECT_DELAY_MS));
      setCreatePhase("idle");
      setName("");
      setDialogOpen(false);
      router.push(`/dashboard/pathways/${pathway.id}`);
      router.refresh();
    } catch {
      setCreatePhase("idle");
    }
  }

  if (loading && pathways === null) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full max-w-xs" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-destructive text-sm">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  const safePathways = pathways ?? [];

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            {t("newPathway")}
          </Button>
        </div>
      ) : null}

      <Dialog open={dialogOpen && canManage} onOpenChange={onDialogOpenChange}>
        <StandardDialogContent
          title={t("newPathwayDialogTitle")}
          description={
            isCreateBusy ? undefined : t("newPathwayDialogDescription")
          }
          size="sm"
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                onClick={() => onDialogOpenChange(false)}
                disabled={isCreateBusy}
              >
                <X className="size-4" />
                {t("dialogCancel")}
              </Button>
              <Button
                type="button"
                className="gap-1.5"
                onClick={() => void handleCreate()}
                disabled={isCreateBusy}
              >
                {isCreateBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                {t("create")}
              </Button>
            </>
          }
        >
          {createPhase === "saving" ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <Loader2 className="text-primary size-10 animate-spin" aria-hidden />
              <p className="text-muted-foreground text-sm leading-relaxed">{t("creatingMessage")}</p>
            </div>
          ) : createPhase === "redirecting" ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <Loader2 className="text-muted-foreground size-10 animate-spin" aria-hidden />
              <p className="text-muted-foreground text-sm leading-relaxed">{t("redirectWaitMessage")}</p>
            </div>
          ) : (
            <Field>
              <FieldLabel htmlFor="new-pathway-name">{t("name")}</FieldLabel>
              <Input
                id="new-pathway-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                autoComplete="off"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleCreate();
                  }
                }}
              />
            </Field>
          )}
        </StandardDialogContent>
      </Dialog>

      <DataTableRoot>
        <DataTableScroll>
          <DataTableHeader className={ROW_GRID}>
            <span>{t("columnPathway")}</span>
            <span className="text-start">{t("columnActions")}</span>
          </DataTableHeader>

          {!safePathways.length ? (
            <DataTableEmpty>{t("empty")}</DataTableEmpty>
          ) : (
            <DataTableBody>
              {safePathways.map((p) => (
                <DataTableRow key={p.id} className={ROW_GRID}>
                  <span className="min-w-0 font-medium">{p.name}</span>
                  <div className="flex justify-start">
                    <Button
                      nativeButton={false}
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      render={<Link href={`/dashboard/pathways/${p.id}`} />}
                    >
                      <ExternalLink className="size-3.5" />
                      {t("open")}
                    </Button>
                  </div>
                </DataTableRow>
              ))}
            </DataTableBody>
          )}
        </DataTableScroll>
      </DataTableRoot>
    </div>
  );
}

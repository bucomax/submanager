import { usePatientPortalTenantSlug } from "@/features/patient-portal/app/context/patient-portal-tenant-context";
import { usePatientPortalFiles } from "@/features/patient-portal/app/hooks/use-patient-portal-files";
import { formatFileSize } from "@/lib/utils/format-bytes";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { ChevronLeft, ChevronRight, ExternalLink, Info, Loader2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";

type Props = {
  formatDateTime: (iso: string) => string;
  onAfterUpload?: () => void;
};

export function PatientPortalFilesSection({ formatDateTime, onAfterUpload }: Props) {
  const tenantSlug = usePatientPortalTenantSlug();
  const t = useTranslations("patientPortal");
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    data,
    loading,
    error,
    page,
    limit,
    goToPage,
    uploadState,
    uploadFile,
    downloadId,
    openDownload,
  } = usePatientPortalFiles(tenantSlug, onAfterUpload);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await uploadFile(file);
  }

  const pag = data?.pagination;
  const from = pag && pag.totalItems === 0 ? 0 : pag ? (page - 1) * limit + 1 : 0;
  const to = pag && pag.totalItems === 0 ? 0 : pag ? Math.min(page * limit, pag.totalItems) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("files.title")}</CardTitle>
        <CardDescription>{t("files.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => void onPickFile(e)}
          />
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={uploadState !== null || loading}
            className="gap-1.5 shadow-sm"
            onClick={() => inputRef.current?.click()}
          >
            {uploadState ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
            {t("files.chooseFile")}
          </Button>
        </div>

        {uploadState ? (
          <div
            className={cn(
              "border-primary/25 from-primary/[0.06] shadow-primary/5 overflow-hidden rounded-xl border bg-gradient-to-br to-transparent p-4 shadow-sm ring-1 ring-primary/10",
            )}
          >
            <div className="flex items-start gap-3">
              <div className="bg-primary/15 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                <Loader2 className="size-5 animate-spin" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-3 pt-0.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium leading-tight">{uploadState.name}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">{t("files.uploading")}</p>
                </div>
                <div className="bg-muted/80 h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="from-primary h-full rounded-full bg-gradient-to-r to-primary/75 transition-[width] duration-200 ease-out"
                    style={{ width: `${Math.max(uploadState.progress, 4)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        {loading && !data ? (
          <p className="text-muted-foreground text-sm">{t("home.loading")}</p>
        ) : null}

        {data && data.data.length === 0 && !loading && !uploadState ? (
          <Alert variant="info" className="border-border/60 bg-muted/25">
            <Info className="size-4 shrink-0" aria-hidden />
            <AlertDescription className="text-muted-foreground text-sm leading-snug">{t("files.empty")}</AlertDescription>
          </Alert>
        ) : null}

        {data && data.data.length > 0 ? (
          <ul className="space-y-2.5">
            {data.data.map((f) => {
              const pending = f.patientPortalReviewStatus === "PENDING";
              const canDownload =
                f.patientPortalReviewStatus === "NOT_APPLICABLE" ||
                f.patientPortalReviewStatus === "APPROVED";
              return (
                <li
                  key={f.id}
                  className="border-border/80 bg-card/60 flex flex-col gap-2 rounded-xl border px-3 py-2.5 shadow-sm transition-colors hover:border-primary/25 hover:bg-muted/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{f.fileName}</p>
                      <p className="text-muted-foreground text-xs tabular-nums">
                        {formatFileSize(f.sizeBytes)} · {formatDateTime(f.createdAt)}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className="h-8 w-8 shrink-0"
                        disabled={!canDownload || downloadId === f.id}
                        aria-label={t("files.download")}
                        onClick={() => void openDownload(f.id)}
                      >
                        {downloadId === f.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <ExternalLink className="size-4" aria-hidden />
                        )}
                      </Button>
                    </div>
                  </div>
                  {pending ? (
                    <Alert variant="info" className="border-border/60 bg-muted/25">
                      <Info className="size-4 shrink-0" aria-hidden />
                      <AlertDescription className="text-muted-foreground text-sm leading-snug">
                        {t("files.statusPending")}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}

        {pag && pag.totalItems > 0 ? (
          <p className="text-muted-foreground text-xs">{t("files.range", { from, to, total: pag.totalItems })}</p>
        ) : null}

        {pag && pag.totalPages > 1 ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || !pag.hasPreviousPage}
              onClick={() => goToPage(page - 1)}
            >
              <ChevronLeft className="size-4" />
              {t("files.prev")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || !pag.hasNextPage}
              onClick={() => goToPage(page + 1)}
            >
              {t("files.next")}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

"use client";

import { ClientDetailStartPathwayCard } from "@/features/clients/app/components/client-detail-start-pathway-card";
import { ClientDetailSwitchPathwayHint } from "@/features/clients/app/components/client-detail-switch-pathway-hint";
import { ClientDetailTimelineSection } from "@/features/clients/app/components/client-detail-timeline-section";
import {
  ClientDetailAssigneeSection,
  ClientDetailChecklistCard,
  ClientDetailJourneyCard,
  ClientDetailNextActionsCard,
} from "@/features/clients/app/components/client-detail-journey-panels";
import { PatientPortalAccessDialog } from "@/features/clients/app/components/patient-portal-access-dialog";
import { PatientSelfRegisterQrDialog } from "@/features/clients/app/components/patient-self-register-qr-dialog";
import { ClientCompletedTreatmentsSection } from "@/features/clients/app/components/client-completed-treatments-section";
import { useClientFileDownload } from "@/features/clients/app/hooks/use-client-file-download";
import { ClientDetailCardTitle } from "@/features/clients/app/components/client-detail-card-title";
import { ClientDetailFilesCard } from "@/features/clients/app/components/client-detail-files-card";
import { ClientDetailNotesCard } from "@/features/clients/app/components/client-detail-notes-card";
import { ClientDetailProfileCard } from "@/features/clients/app/components/client-detail-profile-card";
import { createPatientPortalLink } from "@/features/clients/app/services/clients.service";
import { useClientDetail } from "@/features/clients/app/hooks/use-client-detail";
import { useClientPathwayActions } from "@/features/clients/app/hooks/use-client-pathway-actions";
import { useUpdateClient } from "@/features/clients/app/hooks/use-update-client";
import { TransitionBlockedByChecklistError } from "@/features/pathways/app/services/patient-pathways.service";
import { Link } from "@/i18n/navigation";
import { toast } from "@/lib/toast";
import { waDigits } from "@/lib/utils/phone";
import { formatCpfDisplay } from "@/lib/validators/cpf";
import { formatPhoneBrDisplay } from "@/lib/validators/phone";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { InfoTooltip } from "@/shared/components/ui/info-tooltip";
import { Card, CardContent, CardDescription, CardHeader } from "@/shared/components/ui/card";
import { Dialog, StandardDialogContent } from "@/shared/components/ui/dialog";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRightLeft,
  Check,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileText,
  LayoutDashboard,
  Loader2,
  Mail,
  Phone,
  UserPlus,
  UserRound,
  RefreshCw,
  Save,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

type ClientDetailViewProps = {
  clientId: string;
};

export function ClientDetailView({ clientId }: ClientDetailViewProps) {
  const t = useTranslations("clients.detail");
  const tp = useTranslations("pathways.patient");
  const { data, error, loading, reload } = useClientDetail(clientId);
  const { updateClientById, updating: savingNotes } = useUpdateClient();
  const {
    transitioning: submitting,
    updatingChecklistItemId,
    transitionClientStage,
    toggleChecklistItem,
  } = useClientPathwayActions();

  const [toStageId, setToStageId] = useState("");
  const [note, setNote] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draftCaseDescription, setDraftCaseDescription] = useState("");
  const [timelineRefresh, setTimelineRefresh] = useState(0);
  const [portalLinkBusy, setPortalLinkBusy] = useState<"email" | "copy" | null>(null);
  const { downloadingId: stageDocDownloadingId, openDownload: openStageDocumentDownload } =
    useClientFileDownload();

  /** Identidade da versão do cliente carregada — muda a cada recarga que altera o registro. */
  const clientVersion = data?.client ? `${data.client.id}:${data.client.updatedAt}` : null;
  const storedCaseDescription = data?.client?.caseDescription ?? null;
  const serverCaseDescription = storedCaseDescription ?? "";

  useEffect(() => {
    if (clientVersion === null) return;
    setDraftCaseDescription(serverCaseDescription);
  }, [clientVersion, serverCaseDescription]);

  const pp = data?.patientPathway;
  const nextOptions = useMemo(() => {
    if (!pp?.pathwayVersion?.stages?.length) return [];
    const cur = pp.currentStage?.id;
    return pp.pathwayVersion.stages.filter((s) => s.id !== cur);
  }, [pp]);

  function openTransitionConfirm() {
    if (!pp || !toStageId) {
      toast.error(tp("toStagePlaceholder"));
      return;
    }
    if (toStageId === pp.currentStage?.id) {
      toast.error(tp("sameStage"));
      return;
    }
    setConfirmOpen(true);
  }

  async function executeTransition() {
    if (!pp || !toStageId) return;
    const needsForce = incompleteRequiredChecklist.length > 0;
    const trimmedOverride = overrideReason.trim();
    if (needsForce && trimmedOverride.length < 10) {
      toast.error(t("transition.overrideReasonMin"));
      return;
    }
    try {
      await transitionClientStage(pp.id, {
        toStageId,
        note: note.trim() || undefined,
        ...(needsForce ? { force: true, overrideReason: trimmedOverride } : {}),
      });
      toast.success(tp("success"));
      setConfirmOpen(false);
      setToStageId("");
      setNote("");
      setOverrideReason("");
      reload();
      setTimelineRefresh((n) => n + 1);
    } catch (e) {
      if (e instanceof TransitionBlockedByChecklistError) {
        toast.error(e.message);
        return;
      }
      /* erro: toast global no apiClient */
    }
  }

  async function handleOpenTransitionStageDoc(fileId: string) {
    try {
      await openStageDocumentDownload(fileId);
    } catch {
      toast.error(t("transition.openStageDocumentError"));
    }
  }

  const targetStageName = useMemo(
    () => nextOptions.find((s) => s.id === toStageId)?.name ?? "",
    [nextOptions, toStageId],
  );

  const targetStageDocuments = useMemo(() => {
    if (!pp || !toStageId) return [];
    return pp.pathwayVersion.stages.find((s) => s.id === toStageId)?.documents ?? [];
  }, [pp, toStageId]);

  const incompleteRequiredChecklist = useMemo(
    () =>
      (pp?.currentStage?.checklistItems ?? []).filter((item) => item.requiredForTransition && !item.completed),
    [pp?.currentStage?.checklistItems],
  );

  const trimmedDraftNotes = draftCaseDescription.trim();
  const notesDirty =
    clientVersion !== null &&
    (trimmedDraftNotes === "" ? null : trimmedDraftNotes) !== storedCaseDescription;

  async function saveCaseDescription() {
    const trimmed = draftCaseDescription.trim();
    const payload = trimmed === "" ? null : trimmed;
    try {
      await updateClientById(clientId, { caseDescription: payload });
      toast.success(t("caseNotes.saved"));
      reload();
    } catch {
      /* erro: toast global no apiClient */
    }
  }

  async function handleChecklistToggle(checklistItemId: string, completed: boolean) {
    if (!pp) return;
    try {
      await toggleChecklistItem(pp.id, checklistItemId, completed);
      reload();
    } catch {
      /* erro: toast global no apiClient */
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-2/3 max-w-md" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-destructive text-sm">{error ?? t("loadError")}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
          <RefreshCw className="size-4" />
          {t("retry")}
        </Button>
        <Button nativeButton={false} variant="link" size="sm" className="w-fit px-0" render={<Link href="/dashboard/clients" />}>
          <ArrowLeft className="size-4" />
          {t("backToList")}
        </Button>
      </div>
    );
  }

  const { client } = data;
  const digits = waDigits(client.phone);

  async function handlePatientPortalLink(mode: "email" | "copy") {
    if (portalLinkBusy) return;
    const sendEmail = mode === "email";
    if (sendEmail && !client.email?.trim()) {
      toast.error(t("portalLink.emailRequired"));
      return;
    }
    setPortalLinkBusy(mode);
    try {
      const result = await createPatientPortalLink(client.id, { sendEmail });
      if (result.emailSent) {
        toast.success(t("portalLink.emailSent"));
      } else {
        window.open(result.enterUrl, "_blank", "noopener,noreferrer");
        try {
          await navigator.clipboard.writeText(result.enterUrl);
          toast.success(t("portalLink.copyAndOpened"));
        } catch {
          window.prompt(t("portalLink.copyManually"), result.enterUrl);
          toast.success(t("portalLink.openedTabClipboardManual"));
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("portalLink.error"));
    } finally {
      setPortalLinkBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="border-border/60 space-y-4 border-b pb-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:items-start">
          <Card className="border-border min-w-0 gap-2 shadow-sm">
            <CardHeader className="pb-0">
              <div className="flex items-start justify-between gap-2">
                <ClientDetailCardTitle icon={UserRound} className="min-w-0 flex-1">
                  {t("identitySection.title")}
                </ClientDetailCardTitle>
                <InfoTooltip ariaLabel={t("identitySection.infoAria")}>{t("identitySection.hint")}</InfoTooltip>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xl font-semibold tracking-tight">{client.name}</p>
                {client.isMinor ? (
                  <Badge variant="secondary" className="text-xs font-medium">
                    {t("minorBadge")}
                  </Badge>
                ) : null}
              </div>
              <ul className="text-muted-foreground flex flex-col gap-2.5 text-sm">
                {client.phone?.trim() ? (
                  <li className="bg-muted/30 flex min-w-0 items-center gap-3 rounded-lg border border-border/50 px-3 py-2">
                    <span className="bg-muted/70 text-muted-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-md">
                      <Phone className="size-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0 tabular-nums">{formatPhoneBrDisplay(client.phone)}</span>
                  </li>
                ) : null}
                {client.email?.trim() ? (
                  <li className="bg-muted/30 flex min-w-0 items-center gap-3 rounded-lg border border-border/50 px-3 py-2">
                    <span className="bg-muted/70 text-muted-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-md">
                      <Mail className="size-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0 truncate" title={client.email}>
                      {client.email}
                    </span>
                  </li>
                ) : null}
                {client.documentId ? (
                  <li className="bg-muted/30 flex min-w-0 items-center gap-3 rounded-lg border border-border/50 px-3 py-2">
                    <span className="bg-muted/70 text-muted-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold tracking-wide">
                      {t("cpf")}
                    </span>
                    <span className="min-w-0 tabular-nums">{formatCpfDisplay(client.documentId)}</span>
                  </li>
                ) : null}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border min-w-0 gap-2 shadow-sm">
            <CardHeader className="pb-0">
              <div className="flex items-start justify-between gap-2">
                <ClientDetailCardTitle icon={LayoutDashboard} className="min-w-0 flex-1">
                  {t("portalSection.title")}
                </ClientDetailCardTitle>
                <InfoTooltip ariaLabel={t("portalSection.infoAria")}>{t("portalSection.description")}</InfoTooltip>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pt-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-full justify-start gap-2 bg-background/80 px-3 font-normal"
                disabled={portalLinkBusy !== null || !client.email?.trim()}
                title={!client.email?.trim() ? t("portalLink.emailRequired") : undefined}
                onClick={() => void handlePatientPortalLink("email")}
              >
                {portalLinkBusy === "email" ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Mail className="size-4 shrink-0" aria-hidden />
                )}
                <span className="min-w-0 truncate text-left">{t("portalLink.sendEmail")}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-full justify-start gap-2 bg-background/80 px-3 font-normal"
                disabled={portalLinkBusy !== null}
                onClick={() => void handlePatientPortalLink("copy")}
              >
                {portalLinkBusy === "copy" ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Copy className="size-4 shrink-0" aria-hidden />
                )}
                <span className="min-w-0 truncate text-left">{t("portalLink.copyLink")}</span>
              </Button>
              <PatientPortalAccessDialog
                clientId={client.id}
                triggerLabel={t("portalAccessDialog.trigger")}
                triggerClassName="h-9 w-full justify-start gap-2 bg-background/80 px-3 font-normal"
              />
            </CardContent>
          </Card>

          <Card className="border-border min-w-0 gap-2 shadow-sm md:col-span-2 lg:col-span-1">
            <CardHeader className="pb-0">
              <div className="flex items-start justify-between gap-2">
                <ClientDetailCardTitle icon={UserPlus} className="min-w-0 flex-1">
                  {t("selfRegisterSection.title")}
                </ClientDetailCardTitle>
                <InfoTooltip ariaLabel={t("selfRegisterSection.infoAria")}>
                  {t("selfRegisterSection.description")}
                </InfoTooltip>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pt-0">
              <PatientSelfRegisterQrDialog
                clientId={client.id}
                triggerLabel={t("selfRegisterLinkThisPatient")}
                triggerClassName="h-9 w-full justify-start gap-2 bg-background/80 px-3 font-normal"
              />
              {digits ? (
                <Button
                  nativeButton={false}
                  variant="outline"
                  size="sm"
                  className="h-9 w-full justify-start gap-2 bg-background/80 px-3 font-normal"
                  render={<a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" />}
                >
                  <ExternalLink className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 truncate text-left">{t("whatsapp")}</span>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end pt-1">
          <Button
            nativeButton={false}
            variant="ghost"
            size="sm"
            className="text-muted-foreground -mx-1"
            render={<Link href="/dashboard/clients" />}
          >
            <ArrowLeft className="size-4" />
            {t("backToList")}
          </Button>
        </div>
      </header>

      <div className="columns-1 gap-6 [column-fill:balance] lg:columns-2 [&>*]:mb-6 [&>*]:break-inside-avoid">
      <ClientDetailProfileCard clientId={clientId} client={client} onSaved={reload} />

      <Card className="min-w-0">
        <CardHeader>
          <ClientDetailCardTitle icon={FileText}>{t("caseNotes.title")}</ClientDetailCardTitle>
          <CardDescription>{t("caseNotes.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field>
            <FieldLabel htmlFor="client-case-description">{t("caseNotes.label")}</FieldLabel>
            <textarea
              id="client-case-description"
              rows={5}
              maxLength={20_000}
              value={draftCaseDescription}
              onChange={(e) => setDraftCaseDescription(e.target.value)}
              disabled={savingNotes}
              className={cn(
                "border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-[4.5rem] w-full rounded-lg border px-2.5 py-2 text-base transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
              )}
            />
          </Field>
          <Button
            type="button"
            size="sm"
            disabled={!notesDirty || savingNotes}
            onClick={() => void saveCaseDescription()}
          >
            {savingNotes ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4 shrink-0" aria-hidden />
            )}
            {savingNotes ? t("caseNotes.saving") : t("caseNotes.save")}
          </Button>
        </CardContent>
      </Card>

      <ClientDetailNotesCard clientId={clientId} />

      <ClientDetailFilesCard
        clientId={clientId}
        onFilesMutated={() => setTimelineRefresh((n) => n + 1)}
      />

      {!pp ? (
        <ClientDetailStartPathwayCard
          clientId={client.id}
          hasCompletedHistory={(data.completedTreatments ?? []).length > 0}
          onStarted={() => void reload()}
        />
      ) : (
        <>
          <ClientDetailJourneyCard pp={pp} />
          {pp.completedAt ? null : (
            <ClientDetailSwitchPathwayHint patientPathwayId={pp.id} onCompleted={() => void reload()} />
          )}
          <ClientDetailAssigneeSection pp={pp} />
          <ClientDetailNextActionsCard pp={pp} />
          <ClientDetailChecklistCard
            pp={pp}
            updatingChecklistItemId={updatingChecklistItemId}
            onToggle={(id, checked) => void handleChecklistToggle(id, checked)}
          />

          {pp.completedAt ? null : (
            <>
              <Card className="min-w-0">
                <CardHeader>
                  <ClientDetailCardTitle icon={ArrowRightLeft}>{t("transition.title")}</ClientDetailCardTitle>
                  <CardDescription>{t("transition.description")}</CardDescription>
                </CardHeader>
                <CardContent className="w-full min-w-0 space-y-4">
                  <Field>
                    <FieldLabel>{tp("toStage")}</FieldLabel>
                    <Select value={toStageId || undefined} onValueChange={(v) => setToStageId(v ?? "")}>
                      <SelectTrigger className="w-full min-w-0">
                        <SelectValue placeholder={tp("toStagePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {nextOptions.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="client-detail-note">{tp("note")}</FieldLabel>
                    <Input
                      id="client-detail-note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="—"
                      className="w-full min-w-0"
                    />
                  </Field>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => openTransitionConfirm()}
                    disabled={submitting || nextOptions.length === 0 || !toStageId}
                  >
                    <ClipboardCheck className="size-4 shrink-0" aria-hidden />
                    {t("transition.review")}
                  </Button>
                </CardContent>
              </Card>

              <Dialog
                open={confirmOpen}
                onOpenChange={(open) => {
                  if (!submitting) {
                    setConfirmOpen(open);
                    if (!open) setOverrideReason("");
                  }
                }}
              >
            <StandardDialogContent
              size="sm"
              showCloseButton={!submitting}
              title={t("transition.confirmTitle")}
              description={t("transition.confirmDescription")}
              bodyClassName="py-3"
              footer={
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmOpen(false)}
                    disabled={submitting}
                  >
                    <X className="size-4 shrink-0" aria-hidden />
                    {t("transition.cancelConfirm")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void executeTransition()}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                    ) : (
                      <Check className="size-4 shrink-0" aria-hidden />
                    )}
                    {t("transition.confirmSubmit")}
                  </Button>
                </>
              }
            >
              <div className="text-sm">
                <p>
                  <span className="text-muted-foreground">{t("transition.summaryFrom")} </span>
                  <span className="font-medium">{pp.currentStage?.name ?? "—"}</span>
                </p>
                <p className="mt-2">
                  <span className="text-muted-foreground">{t("transition.summaryTo")} </span>
                  <span className="font-medium">{targetStageName || "—"}</span>
                </p>
                {note.trim() ? (
                  <p className="text-muted-foreground mt-3 text-xs">
                    {t("transition.notePreview", { text: note.trim() })}
                  </p>
                ) : null}
                {incompleteRequiredChecklist.length > 0 ? (
                  <div className="mt-4 border-t pt-3">
                    <Alert variant="destructive" className="mb-3">
                      <AlertDescription className="text-sm">
                        {t("transition.blockedByChecklist")}
                      </AlertDescription>
                    </Alert>
                    <Field>
                      <FieldLabel htmlFor="client-detail-override">{t("transition.overrideReasonLabel")}</FieldLabel>
                      <textarea
                        id="client-detail-override"
                        rows={3}
                        maxLength={2000}
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        disabled={submitting}
                        placeholder={t("transition.overrideReasonPlaceholder")}
                        className={cn(
                          "border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-[4rem] w-full rounded-lg border px-2.5 py-2 text-sm transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
                        )}
                      />
                    </Field>
                    <p className="text-muted-foreground mt-1 text-xs">{t("transition.overrideReasonHint")}</p>
                  </div>
                ) : null}
                <div className="mt-4 border-t pt-3">
                  <p className="text-muted-foreground text-xs font-medium">
                    {t("transition.stageDocumentsTitle")}
                  </p>
                  {targetStageDocuments.length === 0 ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t("transition.stageDocumentsEmpty")}
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {targetStageDocuments.map((d) => (
                        <li
                          key={d.id}
                          className="border-border/70 bg-muted/25 flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2"
                        >
                          <span className="text-foreground min-w-0 flex-1 truncate text-xs font-medium">
                            {d.file.fileName}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            className="h-7 w-7 shrink-0"
                            disabled={stageDocDownloadingId === d.file.id}
                            onClick={() => void handleOpenTransitionStageDoc(d.file.id)}
                            aria-label={t("transition.openStageDocumentAria")}
                          >
                            {stageDocDownloadingId === d.file.id ? (
                              <Loader2 className="size-3.5 animate-spin" aria-hidden />
                            ) : (
                              <ExternalLink className="size-3.5" aria-hidden />
                            )}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </StandardDialogContent>
          </Dialog>
            </>
          )}

        </>
      )}

      <div className="mt-8 min-w-0 w-full [column-span:all]">
        <ClientDetailTimelineSection clientId={clientId} refreshSignal={timelineRefresh} />
      </div>

      <div className="min-w-0 w-full [column-span:all]">
        <ClientCompletedTreatmentsSection
          client={client}
          items={data.completedTreatments ?? []}
        />
      </div>
      </div>
    </div>
  );
}

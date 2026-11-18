"use client";

import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { LeadStagePicker } from "@/features/contacts/app/components/lead-stage-picker";
import { LeadNotesSection } from "@/features/contacts/app/components/lead-notes-section";
import { useLeadClientForm } from "@/features/contacts/app/hooks/use-lead-client-form";
import { STAGE_ORDER } from "@/features/contacts/app/utils/stage-colors";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { calendarDaysFromNow } from "@/lib/utils/date";
import type { ClientDto } from "@/types/api/clients-v1";
import type {
  ConversationCardDto,
  ConversationStatus,
  LeadNoteDto,
  UpsertLeadNoteRequestBody,
} from "@/types/api/contacts-v1";

type LeadPanelProps = {
  open: boolean;
  onClose: () => void;
  conversation: ConversationCardDto;
  stageChangedAt: string;
  stagePickerOpen: boolean;
  onStagePickerOpenChange: (open: boolean) => void;
  onStageChange: (status: ConversationStatus) => Promise<void>;
  notes: LeadNoteDto[];
  createNote: (input: UpsertLeadNoteRequestBody) => Promise<LeadNoteDto>;
  updateNote: (id: string, input: Partial<UpsertLeadNoteRequestBody>) => Promise<LeadNoteDto>;
  deleteNote: (id: string) => Promise<void>;
  /** Chamado quando um lead sem cadastro vira Client — o pai atualiza `conversation.clientId/clientName`. */
  onConverted: (client: ClientDto) => void;
};

export function LeadPanel({
  open,
  onClose,
  conversation,
  stageChangedAt,
  stagePickerOpen,
  onStagePickerOpenChange,
  onStageChange,
  notes,
  createNote,
  updateNote,
  deleteNote,
  onConverted,
}: LeadPanelProps) {
  const t = useTranslations("contacts");
  const { form, setForm, loadingClient, saving, saveHint, save } = useLeadClientForm({
    open,
    conversation,
    onConverted,
  });

  if (!open) return null;

  const daysInStage = calendarDaysFromNow(stageChangedAt);
  const stageIndex = STAGE_ORDER.indexOf(conversation.status);

  return (
    <div className="flex h-full flex-col overflow-hidden border-l bg-card">
      <div className="space-y-3 p-3.5" style={{ background: "#243b47", color: "#e9edef" }}>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t("chat.closeLead")}
                  className="flex size-[26px] items-center justify-center rounded-md hover:bg-white/10"
                >
                  <ChevronLeft className="size-4" />
                </button>
              }
            />
            <TooltipContent>{t("chat.closeLead")}</TooltipContent>
          </Tooltip>
          <p className="text-lg font-extrabold">Lead #{conversation.id.slice(-8)}</p>
        </div>

        <LeadStagePicker
          open={stagePickerOpen}
          onOpenChange={onStagePickerOpenChange}
          currentStage={conversation.status}
          daysInStage={daysInStage}
          onSelect={(stage) => void onStageChange(stage)}
        />

        <div className="flex gap-1">
          {STAGE_ORDER.map((stage, i) => (
            <span
              key={stage}
              className="h-1 flex-1 rounded-full"
              style={{ background: i <= stageIndex ? "#facc15" : "rgba(255,255,255,.18)" }}
            />
          ))}
        </div>
      </div>

      <div className="grid flex-1 auto-rows-min grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-2.5 overflow-y-auto p-3.5">
        {loadingClient || !form ? (
          <p className="col-span-full text-sm text-muted-foreground">…</p>
        ) : (
          <>
            {!conversation.clientId && (
              <p className="col-span-full text-xs text-muted-foreground">{t("chat.leadNotRegistered")}</p>
            )}
            <Field label="Nome">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Telefone">
              <Input className="tabular-nums" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="E-mail">
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="CPF">
              <Input className="tabular-nums" value={form.documentId} onChange={(e) => setForm({ ...form, documentId: e.target.value })} />
            </Field>
            <div className="col-span-full">
              <Field label="Observações">
                <textarea
                  value={form.caseDescription}
                  onChange={(e) => setForm({ ...form, caseDescription: e.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-lg border bg-transparent p-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </Field>
            </div>
          </>
        )}

        <LeadNotesSection notes={notes} createNote={createNote} updateNote={updateNote} deleteNote={deleteNote} />
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t p-3">
        <p className="flex-1 truncate text-xs text-muted-foreground">{saveHint}</p>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("chat.closeLead")}
        </Button>
        <Button type="button" disabled={saving || !form} onClick={() => void save()}>
          {t("chat.saveLead")}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

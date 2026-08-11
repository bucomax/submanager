"use client";

import { useEffect, useState } from "react";
import { listTenantMembersForPicker } from "@/features/settings/app/services/tenant-settings.service";
import { Button } from "@/shared/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { cn } from "@/lib/utils";
import { todayIsoDateLocal } from "@/lib/utils/date";
import { CalendarPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CreateAgendaEventRequestBody, AgendaEventType } from "@/types/api/agenda-v1";
import type { TenantMemberPickerRow } from "@/types/api/tenant-settings-v1";

const TYPES: AgendaEventType[] = ["consulta", "retorno", "exame", "ligacao"];
const DURATIONS = [30, 45, 60, 90];

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type EventComposerProps = {
  leadName: string;
  conversationId: string;
  clientId: string | null;
  onSave: (input: CreateAgendaEventRequestBody) => Promise<void>;
  onCancel: () => void;
};

export function EventComposer({ leadName, conversationId, clientId, onSave, onCancel }: EventComposerProps) {
  const t = useTranslations("contacts.event");
  const [title, setTitle] = useState(t("titlePlaceholder", { lead: leadName }));
  const [type, setType] = useState<AgendaEventType>("consulta");
  const [date, setDate] = useState(todayIsoDateLocal());
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(30);
  const [ownerUserId, setOwnerUserId] = useState("");
  const [members, setMembers] = useState<TenantMemberPickerRow[]>([]);
  const [sendConfirmation, setSendConfirmation] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void listTenantMembersForPicker()
      .then((res) => {
        setMembers(res.members);
        setOwnerUserId((prev) => prev || res.members[0]?.userId || "");
      })
      .catch(() => setMembers([]));
  }, []);

  const dateShortcuts: Array<{ key: string; label: string; iso: string }> = [
    { key: "today", label: t("dateShortcuts.today"), iso: addDaysIso(0) },
    { key: "tomorrow", label: t("dateShortcuts.tomorrow"), iso: addDaysIso(1) },
    { key: "in3Days", label: t("dateShortcuts.in3Days"), iso: addDaysIso(3) },
    { key: "in7Days", label: t("dateShortcuts.in7Days"), iso: addDaysIso(7) },
  ];

  async function handleSave() {
    if (!title.trim() || !date) return;
    setSaving(true);
    try {
      await onSave({
        conversationId,
        clientId,
        title: title.trim(),
        type,
        startsAt: new Date(`${date}T${time}:00`).toISOString(),
        durationMin: duration,
        ownerUserId,
        sendConfirmation,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-pop-in space-y-2.5 rounded-xl border border-l-[3px] border-l-[#0ea5e9] bg-card p-3">
      <div className="flex items-center gap-2">
        <CalendarPlus className="size-3.5 text-[#075985]" aria-hidden />
        <span className="text-[11px] font-extrabold tracking-wide uppercase">{t("formTitle")}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">{t("goesToAgenda")}</span>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-md border bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />

      <div className="flex flex-wrap gap-1.5">
        {TYPES.map((eventType) => (
          <button
            key={eventType}
            type="button"
            onClick={() => setType(eventType)}
            aria-pressed={type === eventType}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-semibold",
              type === eventType ? "border-foreground" : "text-muted-foreground",
            )}
          >
            {t(`type.${eventType}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {dateShortcuts.map((shortcut) => (
          <button
            key={shortcut.key}
            type="button"
            onClick={() => setDate(shortcut.iso)}
            aria-pressed={date === shortcut.iso}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs",
              date === shortcut.iso ? "border-foreground font-semibold" : "text-muted-foreground",
            )}
          >
            {shortcut.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded-md border bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Select value={String(duration)} onValueChange={(v) => v && setDuration(Number(v))}>
          <SelectTrigger className="w-full">
            <SelectValue>{(value) => (value ? `${value} min` : "")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {DURATIONS.map((d) => (
              <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ownerUserId} onValueChange={(v) => v && setOwnerUserId(v)}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {(value) => members.find((m) => m.userId === value)?.name
                ?? members.find((m) => m.userId === value)?.email
                ?? ""}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>{m.name ?? m.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <label className="flex items-center gap-2 text-xs font-medium">
          <Switch checked={sendConfirmation} onCheckedChange={setSendConfirmation} />
          {t("sendConfirmation")}
        </label>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!title.trim() || !date || saving}
            onClick={() => void handleSave()}
          >
            {t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

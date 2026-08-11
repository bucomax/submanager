"use client";

import { STAGE_ORDER } from "@/features/contacts/app/utils/stage-colors";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, CircleDashed } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ConversationStatus } from "@/types/api/contacts-v1";

type LeadStagePickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStage: ConversationStatus;
  daysInStage: number;
  onSelect: (stage: ConversationStatus) => void;
};

/** "Mover lead para" — popover disparado pelo cabeçalho escuro do painel do lead. */
export function LeadStagePicker({ open, onOpenChange, currentStage, daysInStage, onSelect }: LeadStagePickerProps) {
  const t = useTranslations("contacts.stage");

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger className="flex w-full items-center gap-2 rounded-lg px-0 py-1 text-left">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[#e9edef]/60">{t("move")}</p>
          <p className="text-base font-extrabold text-[#e9edef]">
            {t(currentStage)} <span className="font-normal opacity-70">({daysInStage}d)</span>
          </p>
        </div>
        <ChevronDown className="size-4 shrink-0 text-[#e9edef]/70" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[220px] p-1">
        {STAGE_ORDER.map((stage) => (
          <button
            key={stage}
            type="button"
            onClick={() => {
              onSelect(stage);
              onOpenChange(false);
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
              stage === currentStage ? "font-semibold" : "hover:bg-accent",
            )}
          >
            {stage === currentStage ? (
              <Check className="size-3.5 shrink-0" />
            ) : (
              <CircleDashed className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            {t(stage)}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

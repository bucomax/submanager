"use client";

import type { ClientDetailStageDto } from "@/types/api/clients-v1";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, CircleDot } from "lucide-react";

export function stageTimelineState(
  stage: ClientDetailStageDto,
  current: ClientDetailStageDto | null,
  journeyCompleted: boolean,
): "done" | "current" | "pending" {
  if (journeyCompleted && current) {
    if (stage.sortOrder < current.sortOrder) return "done";
    if (stage.id === current.id) return "done";
    return "pending";
  }
  if (!current) return "pending";
  if (stage.id === current.id) return "current";
  if (stage.sortOrder < current.sortOrder) return "done";
  return "pending";
}

export function JourneyStagesList({
  stages,
  current,
  journeyCompleted,
}: {
  stages: ClientDetailStageDto[];
  current: ClientDetailStageDto | null;
  journeyCompleted: boolean;
}) {
  return (
    <ul className="divide-border divide-y overflow-hidden rounded-lg border bg-muted/10">
      {stages.map((stage) => {
        const st = stageTimelineState(stage, current, journeyCompleted);
        const StateIcon = st === "done" ? CheckCircle2 : st === "current" ? CircleDot : Circle;
        return (
          <li
            key={stage.id}
            className={cn(
              "flex items-start gap-3 px-3 py-2.5",
              st === "done" && "bg-success-soft",
              st === "current" && "bg-info-soft",
              st === "pending" && "bg-muted/20 dark:bg-muted/10",
            )}
          >
            <StateIcon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                st === "done" && "text-success",
                st === "current" && "text-info",
                st === "pending" && "text-muted-foreground/55",
              )}
              aria-hidden
            />
            <span
              className={cn(
                "text-sm leading-snug",
                st === "done" && "text-success",
                st === "current" && "font-semibold text-info",
                st === "pending" && "text-muted-foreground",
              )}
            >
              {stage.name}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

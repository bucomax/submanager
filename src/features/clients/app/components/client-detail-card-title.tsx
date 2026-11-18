import type { LucideIcon } from "lucide-react";

import { CardTitle } from "@/shared/components/ui/card";
import { cn } from "@/lib/utils";

type ClientDetailCardTitleProps = {
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
};

export function ClientDetailCardTitle({ icon: Icon, children, className }: ClientDetailCardTitleProps) {
  return (
    <CardTitle className={cn("flex items-center gap-2.5", className)}>
      <span className="bg-accent text-accent-foreground grid size-9 shrink-0 place-items-center rounded-[11px]" aria-hidden>
        <Icon className="size-[18px]" />
      </span>
      {children}
    </CardTitle>
  );
}

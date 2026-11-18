import { CHAT_BACKGROUND_CLASS } from "@/features/contacts/app/utils/chat-style";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ConversationChatSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex min-h-[60px] items-center gap-2 border-b px-3.5">
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-44" />
        </div>
        <Skeleton className="h-[26px] w-24 shrink-0 rounded-full" />
        <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
      </div>

      <div className={cn("flex-1 space-y-3 overflow-hidden p-4", CHAT_BACKGROUND_CLASS)}>
        <div className="flex justify-center">
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex justify-start">
          <Skeleton className="h-12 w-2/3 rounded-2xl rounded-bl-md" />
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-10 w-1/2 rounded-2xl rounded-br-md" />
        </div>
        <div className="flex justify-start">
          <Skeleton className="h-16 w-3/5 rounded-2xl rounded-bl-md" />
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-8 w-2/5 rounded-2xl rounded-br-md" />
        </div>
      </div>

      <div className="border-t bg-background p-[10px_14px_14px]">
        <div className="flex items-center gap-2">
          <Skeleton className="size-[38px] shrink-0 rounded-full" />
          <Skeleton className="size-[38px] shrink-0 rounded-full" />
          <Skeleton className="h-[38px] flex-1 rounded-[10px]" />
          <Skeleton className="size-[38px] shrink-0 rounded-full" />
        </div>
      </div>
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";

import type { PathwayEditorProps } from "@/features/pathways/app/types/components";
import { Skeleton } from "@/shared/components/ui/skeleton";

function PathwayEditorSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-[420px] w-full rounded-xl" />
      <Skeleton className="h-10 w-40" />
    </div>
  );
}

/** Carrega o @xyflow/react só na rota do editor (sem SSR). */
const PathwayEditorDynamic = dynamic(
  () => import("@/features/pathways/app/components/pathway-editor").then((m) => m.PathwayEditor),
  { ssr: false, loading: PathwayEditorSkeleton },
);

export function PathwayEditorLazy(props: PathwayEditorProps) {
  return <PathwayEditorDynamic {...props} />;
}

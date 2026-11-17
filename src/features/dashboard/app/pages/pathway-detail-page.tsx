import { PathwayEditorLazy } from "@/features/pathways/app/components/pathway-editor-lazy";
import { DashboardPage } from "@/shared/components/layout/dashboard-page";
import { Link } from "@/i18n/navigation";
import { Button } from "@/shared/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

type PathwayDetailPageProps = {
  pathwayId: string;
};

export async function PathwayDetailPage({ pathwayId }: PathwayDetailPageProps) {
  const t = await getTranslations("pathways.detail");

  return (
    <DashboardPage
      title={t("title")}
      description={
        <>
          ID: <code className="bg-muted rounded px-1 py-0.5 text-xs">{pathwayId}</code> — {t("description")}
        </>
      }
      actions={
        <Button nativeButton={false} variant="outline" size="sm" render={<Link href="/dashboard/pathways" />}>
          <ArrowLeft className="size-4" />
          {t("back")}
        </Button>
      }
    >
      <PathwayEditorLazy pathwayId={pathwayId} />
    </DashboardPage>
  );
}

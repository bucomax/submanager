import { DashboardPage } from "@/shared/components/layout/dashboard-page";

export function FilesPage() {
  return (
    <DashboardPage
      title="Arquivos"
      description="Biblioteca de arquivos por tenant (upload via presign GCS, metadados em FileAsset)."
    >
      <div className="bg-card text-card-foreground rounded-[20px] border p-6">
        <p className="text-muted-foreground text-sm">
          Grid ou lista com upload e vínculo a pacientes/etapas.
        </p>
      </div>
    </DashboardPage>
  );
}

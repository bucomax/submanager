import { DashboardPage } from "@/shared/components/layout/dashboard-page";

export function AttendancePage() {
  return (
    <DashboardPage
      title="Atendimentos"
      description="Fila de pacientes em acompanhamento, filtros por etapa da jornada e acesso rápido às fichas."
    >
      <div className="bg-card text-card-foreground rounded-[20px] border p-6">
        <p className="text-muted-foreground text-sm">
          Lista operacional (runs / instâncias de PatientPathway) será integrada às APIs de transição.
        </p>
      </div>
    </DashboardPage>
  );
}

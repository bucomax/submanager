-- StageTransition: chave de idempotência (única por PatientPathway; NULLs não colidem)
ALTER TABLE "StageTransition" ADD COLUMN "correlationId" TEXT;
CREATE UNIQUE INDEX "StageTransition_patientPathwayId_correlationId_key" ON "StageTransition"("patientPathwayId", "correlationId");

-- Excluir User não pode apagar histórico clínico (transições e notas)
ALTER TABLE "StageTransition" DROP CONSTRAINT "StageTransition_actorUserId_fkey";
ALTER TABLE "StageTransition" ADD CONSTRAINT "StageTransition_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PatientNote" DROP CONSTRAINT "PatientNote_authorUserId_fkey";
ALTER TABLE "PatientNote" ADD CONSTRAINT "PatientNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

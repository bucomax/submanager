import type {
  PatientPathwayDetail,
  TransitionPatientStageInput,
} from "@/features/pathways/app/types/patient-pathways";

export type PatientPathwayPanelProps = {
  patientPathwayId: string;
};

export type PatientPathwayTransitionCardProps = {
  data: PatientPathwayDetail;
  nextOptions: PatientPathwayDetail["pathwayVersion"]["stages"];
  submitting: boolean;
  submitTransition: (input: TransitionPatientStageInput) => Promise<void>;
};

export type PathwayEditorProps = {
  pathwayId: string;
};

export type SelectedPathwayNodeUpdate = {
  label?: string;
  patientMessage?: string;
};

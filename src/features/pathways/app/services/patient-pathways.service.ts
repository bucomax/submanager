import { normalizeApiError } from "@/lib/api/axios-error";
import { apiClient } from "@/lib/api/http-client";
import type { ApiErrorEnvelope } from "@/lib/api/envelope";
import type { ApiEnvelope } from "@/shared/types/api/v1";
import { AxiosError } from "axios";
import type { PatchPatientChecklistItemResponseData } from "@/types/api/patient-pathways-v1";
import type {
  PatientPathwayDetail,
  TogglePatientChecklistItemInput,
  TransitionPatientStageInput,
} from "@/features/pathways/app/types/patient-pathways";

export class TransitionBlockedByChecklistError extends Error {
  readonly pendingItems: { id: string; label: string }[];

  constructor(message: string, pendingItems: { id: string; label: string }[]) {
    super(message);
    this.name = "TransitionBlockedByChecklistError";
    this.pendingItems = pendingItems;
  }
}

export async function getPatientPathway(patientPathwayId: string): Promise<PatientPathwayDetail> {
  try {
    const res = await apiClient.get<ApiEnvelope<{ patientPathway: PatientPathwayDetail }>>(
      `/api/v1/patient-pathways/${patientPathwayId}`,
    );
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
    return res.data.data.patientPathway;
  } catch (e) {
    throw normalizeApiError(e);
  }
}

export async function transitionPatientStage(
  patientPathwayId: string,
  body: TransitionPatientStageInput,
): Promise<void> {
  try {
    const res = await apiClient.post<ApiEnvelope<{ patientPathway: unknown }>>(
      `/api/v1/patient-pathways/${patientPathwayId}/transition`,
      body,
    );
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
  } catch (e) {
    if (e instanceof AxiosError) {
      const data = e.response?.data as Partial<ApiErrorEnvelope> | undefined;
      const err = data?.error;
      if (err?.code === "CHECKLIST_REQUIRED_INCOMPLETE" && err.details && typeof err.details === "object") {
        const raw = err.details as { pendingItems?: unknown };
        const pending = Array.isArray(raw.pendingItems)
          ? raw.pendingItems.filter(
              (x): x is { id: string; label: string } =>
                x != null &&
                typeof x === "object" &&
                typeof (x as { id?: unknown }).id === "string" &&
                typeof (x as { label?: unknown }).label === "string",
            )
          : [];
        throw new TransitionBlockedByChecklistError(err.message ?? "Checklist incompleto", pending);
      }
    }
    throw normalizeApiError(e);
  }
}

export async function completePatientPathway(patientPathwayId: string): Promise<void> {
  try {
    const res = await apiClient.post<ApiEnvelope<{ patientPathway: unknown }>>(
      `/api/v1/patient-pathways/${patientPathwayId}/complete`,
    );
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
  } catch (e) {
    throw normalizeApiError(e);
  }
}

export async function togglePatientChecklistItem(
  patientPathwayId: string,
  checklistItemId: string,
  body: TogglePatientChecklistItemInput,
): Promise<PatchPatientChecklistItemResponseData["item"]> {
  try {
    const res = await apiClient.patch<ApiEnvelope<PatchPatientChecklistItemResponseData>>(
      `/api/v1/patient-pathways/${patientPathwayId}/checklist-items/${checklistItemId}`,
      body,
    );
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
    return res.data.data.item;
  } catch (e) {
    throw normalizeApiError(e);
  }
}

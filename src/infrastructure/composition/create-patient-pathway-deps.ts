import type { CreatePatientPathwayDeps } from "@/application/use-cases/patient-pathway/create-patient-pathway.core";
import { findTenantClientVisibleToActor } from "@/infrastructure/visibility/client-visibility-scope";
import { notificationEmitter } from "@/infrastructure/notifications/notification-emitter";
import { patientPathwayStartPrismaStore } from "@/infrastructure/repositories/patient-pathway-start.repository";
import {
  notificationTargetResolver,
  tenantListCache,
  whatsAppDispatchQueue,
} from "@/infrastructure/composition/shared-adapters";

export const defaultCreatePatientPathwayDeps: CreatePatientPathwayDeps = {
  store: patientPathwayStartPrismaStore,
  clients: {
    findVisibleClient: (actor, tenantId, clientId) =>
      findTenantClientVisibleToActor(actor, tenantId, clientId, {
        id: true,
        assignedToUserId: true,
      }),
  },
  cache: tenantListCache,
  notificationTargets: notificationTargetResolver,
  notifications: notificationEmitter,
  whatsappQueue: whatsAppDispatchQueue,
};

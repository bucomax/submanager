import type { IDistributedLock } from "@/application/ports/distributed-lock.port";
import type { IEmailDispatchQueue, IWhatsAppDispatchQueue } from "@/application/ports/dispatch-queues.port";
import type { INotificationTargetResolver } from "@/application/ports/notification-target-resolver.port";
import type { ITenantListCache } from "@/application/ports/tenant-list-cache.port";
import type { ITenantProfileReader } from "@/application/ports/tenant-profile-reader.port";
import { resolvePathwayNotificationTargetUserIds } from "@/infrastructure/notifications/resolve-notification-targets";
import {
  revalidateTenantClientsList,
  revalidateTenantOpmeSuppliersList,
  revalidateTenantPathwaysAndClientsLists,
} from "@/infrastructure/cache/revalidate-tenant-lists";
import { enqueueEmailDispatch } from "@/infrastructure/email/email-dispatch-emitter";
import { notificationEmitter } from "@/infrastructure/notifications/notification-emitter";
import { tenantPrismaRepository } from "@/infrastructure/repositories/tenant.repository";
import { enqueueWhatsAppDispatch } from "@/infrastructure/whatsapp/whatsapp-dispatch-emitter";
import { acquireLock } from "@/lib/api/distributed-lock";
import { getPublicAppUrl } from "@/lib/config/urls";
import type { TransitionPostCommitDeps } from "@/application/use-cases/pathway/transition-post-commit";

export const distributedLock: IDistributedLock = { acquire: acquireLock };

export const tenantListCache: ITenantListCache = {
  revalidateClientsList: revalidateTenantClientsList,
  revalidatePathwaysAndClientsLists: revalidateTenantPathwaysAndClientsLists,
  revalidateOpmeSuppliersList: revalidateTenantOpmeSuppliersList,
};

export const notificationTargetResolver: INotificationTargetResolver = {
  resolveForPathway: resolvePathwayNotificationTargetUserIds,
};

export const tenantProfileReader: ITenantProfileReader = {
  findNameAndSlug: (tenantId) => tenantPrismaRepository.findTenantNameAndSlugById(tenantId),
};

export const emailDispatchQueue: IEmailDispatchQueue = {
  enqueueStageTransitionPatientEmail: ({ jobId, ...payload }) =>
    enqueueEmailDispatch({ kind: "stage_transition_patient", ...payload }, { jobId }),
};

export const whatsAppDispatchQueue: IWhatsAppDispatchQueue = {
  enqueue: enqueueWhatsAppDispatch,
};

export const transitionPostCommitDeps: TransitionPostCommitDeps = {
  notificationTargets: notificationTargetResolver,
  notifications: notificationEmitter,
  tenants: tenantProfileReader,
  emailQueue: emailDispatchQueue,
  whatsappQueue: whatsAppDispatchQueue,
  getPublicAppUrl,
};

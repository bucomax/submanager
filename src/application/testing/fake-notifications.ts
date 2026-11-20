import type {
  DocumentDeliveryStaffEmailInput,
  IEmailDispatchQueue,
  IWhatsAppDispatchQueue,
  StageTransitionPatientEmailInput,
} from "@/application/ports/dispatch-queues.port";
import type { EmitNotificationInput, INotificationEmitter } from "@/application/ports/notification-emitter.port";
import type { INotificationTargetResolver } from "@/application/ports/notification-target-resolver.port";
import type { ITenantProfileReader } from "@/application/ports/tenant-profile-reader.port";
import type { WhatsAppDispatchInput } from "@/application/ports/whatsapp-dispatcher.port";
import type { TransitionPostCommitDeps } from "@/application/use-cases/pathway/transition-post-commit";

export class FakeNotificationEmitter implements INotificationEmitter {
  readonly emitted: EmitNotificationInput[] = [];

  async emit(input: EmitNotificationInput): Promise<void> {
    this.emitted.push(input);
  }
}

export class FakeNotificationTargetResolver implements INotificationTargetResolver {
  constructor(private readonly userIds: string[] = ["user-staff"]) {}

  async resolveForPathway(): Promise<string[]> {
    return this.userIds;
  }
}

export class FakeEmailQueue implements IEmailDispatchQueue {
  readonly enqueued: StageTransitionPatientEmailInput[] = [];
  readonly documentDeliveries: DocumentDeliveryStaffEmailInput[] = [];

  async enqueueStageTransitionPatientEmail(input: StageTransitionPatientEmailInput): Promise<void> {
    this.enqueued.push(input);
  }

  async enqueueDocumentDeliveryStaffEmail(input: DocumentDeliveryStaffEmailInput): Promise<void> {
    this.documentDeliveries.push(input);
  }
}

export class FakeWhatsAppQueue implements IWhatsAppDispatchQueue {
  readonly enqueued: WhatsAppDispatchInput[] = [];

  async enqueue(input: WhatsAppDispatchInput): Promise<void> {
    this.enqueued.push(input);
  }
}

export function createFakePostCommitDeps(
  tenant: { name: string; slug: string } | null = { name: "Clínica Teste", slug: "clinica" },
) {
  const notifications = new FakeNotificationEmitter();
  const emailQueue = new FakeEmailQueue();
  const whatsappQueue = new FakeWhatsAppQueue();
  const tenants: ITenantProfileReader = { findNameAndSlug: async () => tenant };
  const deps: TransitionPostCommitDeps = {
    notificationTargets: new FakeNotificationTargetResolver(),
    notifications,
    tenants,
    emailQueue,
    whatsappQueue,
    getPublicAppUrl: () => "https://app.test",
  };
  return { deps, notifications, emailQueue, whatsappQueue };
}

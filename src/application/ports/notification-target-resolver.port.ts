import type { NotificationType } from "@prisma/client";

export interface INotificationTargetResolver {
  resolveForPathway(args: {
    tenantId: string;
    type: NotificationType;
    currentStageAssigneeUserId: string | null;
  }): Promise<string[]>;
}

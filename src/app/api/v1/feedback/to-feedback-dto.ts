import type { FeedbackReport, User } from "@prisma/client";
import type { FeedbackDto } from "@/types/api/feedback-v1";

type RowWithAuthor = FeedbackReport & {
  author: Pick<User, "id" | "name" | "email"> | null;
};

export function toFeedbackDto(row: RowWithAuthor): FeedbackDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    type: row.type,
    status: row.status,
    message: row.message,
    sentryEventId: row.sentryEventId,
    requestId: row.requestId,
    pagePath: row.pagePath,
    appVersion: row.appVersion,
    locale: row.locale,
    adminNote: row.adminNote,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    author: row.author
      ? { id: row.author.id, name: row.author.name, email: row.author.email }
      : null,
  };
}

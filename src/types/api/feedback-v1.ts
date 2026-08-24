import type { ApiPagination } from "@/lib/api/pagination";

export type FeedbackType = "bug" | "suggestion" | "question" | "other";

export type FeedbackStatus =
  | "open"
  | "triaged"
  | "in_progress"
  | "resolved"
  | "wont_fix"
  | "duplicate";

export type FeedbackDto = {
  id: string;
  tenantId: string;
  type: FeedbackType;
  status: FeedbackStatus;
  message: string;
  sentryEventId: string | null;
  requestId: string | null;
  pagePath: string;
  appVersion: string | null;
  locale: string;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  author: { id: string; name: string | null; email: string } | null;
};

export type CreateFeedbackRequestBody = {
  type: FeedbackType;
  message: string;
  sentryEventId?: string | null;
  requestId?: string | null;
  pagePath: string;
  locale: string;
};

export type CreateFeedbackResponseData = {
  feedback: FeedbackDto;
};

export type ListFeedbackQueryParams = {
  page?: number;
  limit?: number;
  status?: FeedbackStatus;
  type?: FeedbackType;
  tenantId?: string;
};

export type FeedbackListResponseData = {
  data: FeedbackDto[];
  pagination: ApiPagination;
};

export type UpdateFeedbackRequestBody = {
  status?: FeedbackStatus;
  adminNote?: string | null;
};

export type UpdateFeedbackResponseData = {
  feedback: FeedbackDto;
};

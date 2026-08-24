import type { FeedbackStatus, FeedbackType, Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";

const authorSelect = { select: { id: true, name: true, email: true } } as const;

export const feedbackReportPrismaRepository = {
  async create(input: {
    tenantId: string;
    authorUserId: string;
    type: FeedbackType;
    message: string;
    sentryEventId: string | null;
    requestId: string | null;
    pagePath: string;
    userAgent: string | null;
    appVersion: string | null;
    locale: string;
  }) {
    return prisma.feedbackReport.create({
      data: input,
      include: { author: authorSelect },
    });
  },

  async listForSuperAdmin(filters: {
    page: number;
    limit: number;
    status?: FeedbackStatus;
    type?: FeedbackType;
    tenantId?: string;
  }) {
    const where: Prisma.FeedbackReportWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
    };

    const [rows, totalItems] = await Promise.all([
      prisma.feedbackReport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: { author: authorSelect },
      }),
      prisma.feedbackReport.count({ where }),
    ]);

    return { rows, totalItems };
  },

  async updateStatus(id: string, input: { status?: FeedbackStatus; adminNote?: string | null }) {
    return prisma.feedbackReport.update({
      where: { id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.adminNote !== undefined ? { adminNote: input.adminNote } : {}),
        ...(input.status === "resolved" ? { resolvedAt: new Date() } : {}),
      },
      include: { author: authorSelect },
    });
  },
};

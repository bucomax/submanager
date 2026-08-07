import {
  ConversationChannel,
  ConversationStatus,
  MessageDirection,
  MessageStatus,
  MessageType,
  type PrismaClient,
} from "@prisma/client";

import type { TenantContext } from "./types";
import { daysAgo } from "./utils";

/**
 * Seed demonstrativo do kanban de contatos multicanal (read-only nesta fase).
 * Ver docs/superpowers/specs/2026-08-03-kanban-contatos-multicanal-design.md
 */

type SeedMessage = {
  direction: "inbound" | "outbound";
  body: string;
  daysAgoValue: number;
  hour: number;
  actorKey?: "admin" | "user";
};

type ConversationSeed = {
  key: string;
  displayName: string;
  externalId: string;
  status: ConversationStatus;
  clientId?: string | null;
  assignedToUserId?: string | null;
  unreadCount: number;
  messages: SeedMessage[];
};

function normalizePhoneToExternalId(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function buildConversationSeeds(context: {
  actors: TenantContext["actors"];
  qualifiedClient: { id: string; name: string; phone: string } | null;
}): ConversationSeed[] {
  const { actors, qualifiedClient } = context;
  const qualifiedFirstName = qualifiedClient?.name.split(" ")[0] ?? "paciente";

  return [
    {
      key: "camila-duarte",
      displayName: "Camila Duarte",
      externalId: "5511987602001",
      status: ConversationStatus.new,
      unreadCount: 1,
      messages: [
        {
          direction: "inbound",
          daysAgoValue: 1,
          hour: 10,
          body: "Oi! Vi o antes e depois de vocês no Instagram. Fazem rinoplastia?",
        },
      ],
    },
    {
      key: "beatriz-lopes",
      displayName: "Beatriz Lopes",
      externalId: "5511987602002",
      status: ConversationStatus.new,
      unreadCount: 2,
      messages: [
        {
          direction: "inbound",
          daysAgoValue: 2,
          hour: 9,
          body: "Bom dia! Gostaria de saber o valor da avaliação para mamoplastia de aumento.",
        },
        {
          direction: "inbound",
          daysAgoValue: 1,
          hour: 8,
          body: "Vocês parcelam no cartão?",
        },
      ],
    },
    {
      key: "juliana-prado",
      displayName: "Juliana Prado",
      externalId: "5511987602003",
      status: ConversationStatus.new,
      unreadCount: 1,
      messages: [
        {
          direction: "inbound",
          daysAgoValue: 1,
          hour: 19,
          body: "Boa noite, fazem lipoaspiração de flancos e abdômen juntos?",
        },
      ],
    },
    {
      key: "renata-souza",
      displayName: "Renata Souza",
      externalId: "5511987602004",
      status: ConversationStatus.in_progress,
      assignedToUserId: actors.user.id,
      unreadCount: 0,
      messages: [
        {
          direction: "inbound",
          daysAgoValue: 4,
          hour: 14,
          body: "Olá, tenho uma dúvida sobre o pós-operatório de abdominoplastia.",
        },
        {
          direction: "outbound",
          daysAgoValue: 4,
          hour: 15,
          actorKey: "user",
          body: "Oi Renata! Claro, pode perguntar.",
        },
        {
          direction: "inbound",
          daysAgoValue: 3,
          hour: 9,
          body: "Quanto tempo preciso usar a cinta modeladora?",
        },
        {
          direction: "outbound",
          daysAgoValue: 3,
          hour: 10,
          actorKey: "user",
          body: "Em média 30 a 45 dias, varia conforme a evolução. Quer agendar uma consulta com o cirurgião?",
        },
      ],
    },
    {
      key: "larissa-martins",
      displayName: "Larissa Martins",
      externalId: "5511987602005",
      status: ConversationStatus.in_progress,
      assignedToUserId: actors.admin.id,
      unreadCount: 0,
      messages: [
        {
          direction: "inbound",
          daysAgoValue: 5,
          hour: 11,
          body: "Olá, quero saber sobre o orçamento da blefaroplastia.",
        },
        {
          direction: "outbound",
          daysAgoValue: 3,
          hour: 16,
          actorKey: "admin",
          body: "Oi Larissa! Vou te passar os detalhes. Pode me confirmar seu nome completo e telefone para contato?",
        },
        {
          direction: "inbound",
          daysAgoValue: 2,
          hour: 17,
          body: "Larissa Martins, mesmo número. Consigo avaliação essa semana?",
        },
      ],
    },
    {
      key: "fernanda-ramos",
      displayName: "Fernanda Ramos",
      externalId: "5511987602006",
      status: ConversationStatus.qualified,
      assignedToUserId: actors.admin.id,
      unreadCount: 0,
      messages: [
        {
          direction: "inbound",
          daysAgoValue: 6,
          hour: 9,
          body: "Oi, retornando o contato sobre a rinoplastia.",
        },
        {
          direction: "outbound",
          daysAgoValue: 6,
          hour: 10,
          actorKey: "admin",
          body: "Oi Fernanda! Que bom falar com você. Vamos agendar sua avaliação inicial?",
        },
        {
          direction: "inbound",
          daysAgoValue: 5,
          hour: 15,
          body: "Pode ser na quinta-feira de manhã?",
        },
        {
          direction: "outbound",
          daysAgoValue: 5,
          hour: 16,
          actorKey: "admin",
          body: "Perfeito, agendei para quinta às 9h. Te aguardamos!",
        },
      ],
    },
    {
      key: "patricia-nunes",
      displayName: "Patrícia Nunes",
      externalId: "5511987602007",
      status: ConversationStatus.discarded,
      unreadCount: 0,
      messages: [
        {
          direction: "inbound",
          daysAgoValue: 12,
          hour: 13,
          body: "Oi, quanto custa uma lipoaspiração completa?",
        },
        {
          direction: "outbound",
          daysAgoValue: 12,
          hour: 14,
          actorKey: "user",
          body: "Oi Patrícia! Cada caso é avaliado individualmente na consulta. Poderia nos contar mais sobre o seu objetivo?",
        },
        {
          direction: "inbound",
          daysAgoValue: 10,
          hour: 18,
          body: "Achei o valor da consulta salgado, vou pesquisar em outro lugar. Obrigada!",
        },
      ],
    },
    {
      key: "qualified-existing-client",
      displayName: qualifiedClient?.name ?? "Paciente qualificada",
      externalId: qualifiedClient ? normalizePhoneToExternalId(qualifiedClient.phone) : "5511987602008",
      status: ConversationStatus.qualified,
      clientId: qualifiedClient?.id ?? null,
      assignedToUserId: actors.admin.id,
      unreadCount: 0,
      messages: [
        {
          direction: "inbound",
          daysAgoValue: 7,
          hour: 9,
          body: `Oi, sou a ${qualifiedFirstName}, gostaria de agendar minha cirurgia de prótese de silicone.`,
        },
        {
          direction: "outbound",
          daysAgoValue: 7,
          hour: 10,
          actorKey: "admin",
          body: `Oi ${qualifiedFirstName}! Já temos seus exames pré-operatórios em dia, vamos confirmar a data com o cirurgião.`,
        },
        {
          direction: "inbound",
          daysAgoValue: 6,
          hour: 15,
          body: "Combinado, fico no aguardo!",
        },
      ],
    },
  ];
}

export async function seedConversations(
  prisma: PrismaClient,
  context: Pick<TenantContext, "tenantId" | "actors">,
) {
  const { tenantId, actors } = context;

  const qualifiedClient = await prisma.client.findFirst({
    where: { tenantId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, phone: true },
  });

  const conversationSeeds = buildConversationSeeds({ actors, qualifiedClient });

  let messageCount = 0;

  for (const seed of conversationSeeds) {
    const firstMessage = seed.messages[0]!;
    const lastMessage = seed.messages[seed.messages.length - 1]!;
    const lastInbound = [...seed.messages].reverse().find((message) => message.direction === "inbound");
    const firstOutbound = seed.messages.find((message) => message.direction === "outbound");

    const conversation = await prisma.conversation.create({
      data: {
        tenantId,
        channel: ConversationChannel.whatsapp,
        externalId: seed.externalId,
        displayName: seed.displayName,
        clientId: seed.clientId ?? null,
        status: seed.status,
        assignedToUserId: seed.assignedToUserId ?? null,
        lastInboundAt: lastInbound ? daysAgo(lastInbound.daysAgoValue, lastInbound.hour) : null,
        lastMessageAt: daysAgo(lastMessage.daysAgoValue, lastMessage.hour),
        firstResponseAt: firstOutbound ? daysAgo(firstOutbound.daysAgoValue, firstOutbound.hour) : null,
        unreadCount: seed.unreadCount,
        createdAt: daysAgo(firstMessage.daysAgoValue, firstMessage.hour),
      },
    });

    for (const message of seed.messages) {
      const isOutbound = message.direction === "outbound";
      const createdAt = daysAgo(message.daysAgoValue, message.hour);

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: isOutbound ? MessageDirection.outbound : MessageDirection.inbound,
          type: MessageType.text,
          body: message.body,
          status: isOutbound ? MessageStatus.delivered : MessageStatus.sent,
          actorUserId: isOutbound && message.actorKey ? actors[message.actorKey].id : null,
          sentAt: isOutbound ? createdAt : null,
          deliveredAt: isOutbound ? createdAt : null,
          createdAt,
        },
      });
      messageCount += 1;
    }
  }

  return { conversationCount: conversationSeeds.length, messageCount };
}

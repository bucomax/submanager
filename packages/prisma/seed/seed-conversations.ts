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
      key: "fernanda-ribeiro",
      displayName: "Fernanda Ribeiro",
      externalId: "5511987601001",
      status: ConversationStatus.new,
      unreadCount: 1,
      messages: [
        {
          direction: "inbound",
          daysAgoValue: 2,
          hour: 10,
          body: "Oi, vi o anúncio de vocês no Instagram. Fazem cirurgia ortognática?",
        },
      ],
    },
    {
      key: "marcos-andrade",
      displayName: "Marcos Andrade",
      externalId: "5511987601002",
      status: ConversationStatus.new,
      unreadCount: 2,
      messages: [
        {
          direction: "inbound",
          daysAgoValue: 3,
          hour: 9,
          body: "Bom dia! Gostaria de saber o valor da avaliação inicial.",
        },
        {
          direction: "inbound",
          daysAgoValue: 2,
          hour: 8,
          body: "Vocês atendem por convênio?",
        },
      ],
    },
    {
      key: "patricia-gomes",
      displayName: "Patrícia Gomes",
      externalId: "5511987601003",
      status: ConversationStatus.in_progress,
      assignedToUserId: actors.user.id,
      unreadCount: 0,
      messages: [
        {
          direction: "inbound",
          daysAgoValue: 4,
          hour: 14,
          body: "Olá, tenho uma dúvida sobre o pós-operatório de cirurgia ortognática.",
        },
        {
          direction: "outbound",
          daysAgoValue: 4,
          hour: 15,
          actorKey: "user",
          body: "Oi Patrícia! Claro, pode perguntar.",
        },
        {
          direction: "inbound",
          daysAgoValue: 3,
          hour: 9,
          body: "Quanto tempo fico de repouso?",
        },
        {
          direction: "outbound",
          daysAgoValue: 3,
          hour: 10,
          actorKey: "user",
          body: "Em média 10 a 15 dias, mas depende da avaliação do cirurgião. Quer agendar uma consulta?",
        },
      ],
    },
    {
      key: "rodrigo-nascimento",
      displayName: "Rodrigo Nascimento",
      externalId: "5511987601004",
      status: ConversationStatus.waiting_contact,
      assignedToUserId: actors.admin.id,
      unreadCount: 0,
      messages: [
        {
          direction: "inbound",
          daysAgoValue: 5,
          hour: 11,
          body: "Olá, quero saber sobre o orçamento do implante.",
        },
        {
          direction: "outbound",
          daysAgoValue: 3,
          hour: 16,
          actorKey: "admin",
          body: "Oi Rodrigo! Vou te passar os detalhes. Pode me confirmar seu nome completo e telefone para contato?",
        },
      ],
    },
    {
      key: "juliana-ferreira",
      displayName: "Juliana Ferreira",
      externalId: "5511987601006",
      status: ConversationStatus.discarded,
      unreadCount: 0,
      messages: [
        {
          direction: "inbound",
          daysAgoValue: 10,
          hour: 13,
          body: "Oi, quanto custa uma cirurgia bucomaxilofacial?",
        },
        {
          direction: "outbound",
          daysAgoValue: 10,
          hour: 14,
          actorKey: "user",
          body: "Oi Juliana! Cada caso é avaliado individualmente. Poderia nos contar mais sobre o seu caso?",
        },
      ],
    },
    {
      key: "qualified-existing-client",
      displayName: qualifiedClient?.name ?? "Paciente qualificado",
      externalId: qualifiedClient ? normalizePhoneToExternalId(qualifiedClient.phone) : "5511987601005",
      status: ConversationStatus.qualified,
      clientId: qualifiedClient?.id ?? null,
      assignedToUserId: actors.admin.id,
      unreadCount: 0,
      messages: [
        {
          direction: "inbound",
          daysAgoValue: 6,
          hour: 9,
          body: `Oi, sou a ${qualifiedFirstName}, retornando o contato sobre a cirurgia ortognática.`,
        },
        {
          direction: "outbound",
          daysAgoValue: 6,
          hour: 10,
          actorKey: "admin",
          body: `Oi ${qualifiedFirstName}! Que bom falar com você. Vamos agendar sua avaliação inicial?`,
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

import type { DocumentDeliveryStaffEmailInput } from "@/application/ports/dispatch-queues.port";
import { prisma } from "@/infrastructure/database/prisma";
import { canSendEmailForTenant } from "@/infrastructure/email/email-availability";
import { enqueueEmailDispatch } from "@/infrastructure/email/email-dispatch-emitter";
import { maskEmail, maskPhone } from "@/lib/utils/mask-contact";

/**
 * Confirmação de disparo de documentos (flag `notifyDocumentDelivery`): avisa quem moveu o paciente
 * e o responsável pela etapa por quais canais o pacote foi disparado. Os canais refletem exatamente
 * as condições em que os envios ao paciente acontecem (e-mail: endereço + slug + transporte disponível;
 * WhatsApp: telefone + WhatsApp ligado e credenciais completas, como no dispatcher). O e-mail à equipe
 * não afirma entrega: o resultado real do WhatsApp/e-mail é assíncrono e aparece na linha do tempo.
 */
export async function enqueueDocumentDeliveryStaffEmail(input: DocumentDeliveryStaffEmailInput): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: {
      name: true,
      slug: true,
      notifyDocumentDelivery: true,
      whatsappEnabled: true,
      whatsappPhoneNumberId: true,
      whatsappAccessTokenEnc: true,
    },
  });
  if (!tenant?.notifyDocumentDelivery) return;

  const members = await prisma.tenantMembership.findMany({
    where: { tenantId: input.tenantId, userId: { in: [...new Set(input.candidateUserIds)] } },
    select: { userId: true },
  });
  const targetUserIds = members.map((m) => m.userId);
  if (targetUserIds.length === 0) return;

  const email = input.client.email?.trim();
  const phone = input.client.phone?.trim();
  const emailDispatched = Boolean(email && tenant.slug?.trim() && (await canSendEmailForTenant(input.tenantId)));
  // Mesma condição do dispatcher: sem número/credencial ele pula o envio sem registrar nada.
  const whatsappDispatched = Boolean(
    phone && tenant.whatsappEnabled && tenant.whatsappPhoneNumberId && tenant.whatsappAccessTokenEnc,
  );

  await enqueueEmailDispatch(
    {
      kind: "document_delivery_staff",
      tenantId: input.tenantId,
      data: {
        patientName: input.client.name,
        clientId: input.client.id,
        stageName: input.stageName,
        documents: input.documents.map((d) => d.fileName),
        emailTo: emailDispatched && email ? maskEmail(email) : null,
        whatsappTo: whatsappDispatched && phone ? maskPhone(phone) : null,
        targetUserIds,
        clinicName: tenant.name?.trim() || "Clínica",
      },
    },
    { jobId: `email|docs|${input.tenantId}|${input.transitionId}` },
  );
}

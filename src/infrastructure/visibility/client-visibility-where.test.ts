import { describe, expect, it } from "vitest";

import {
  buildAgendaEventVisibilityWhereInput,
  buildConversationVisibilityWhereInput,
} from "@/infrastructure/visibility/client-visibility-where";

const VIEWER = "user-1";
const admin = { role: "tenant_admin", restrictedToAssignedOnly: false, linkedOpmeSupplierId: null };
const unrestricted = { role: "tenant_user", restrictedToAssignedOnly: false, linkedOpmeSupplierId: null };
const assignedOnly = { role: "tenant_user", restrictedToAssignedOnly: true, linkedOpmeSupplierId: null };
const opme = { role: "tenant_user", restrictedToAssignedOnly: false, linkedOpmeSupplierId: "opme-1" };

describe("buildConversationVisibilityWhereInput", () => {
  it("should not restrict admins nor unrestricted members", () => {
    expect(buildConversationVisibilityWhereInput(admin, VIEWER)).toEqual({});
    expect(buildConversationVisibilityWhereInput(unrestricted, VIEWER)).toEqual({});
  });

  it("should allow assigned-only users to see linked clients assigned to them or unlinked leads assigned to them", () => {
    expect(buildConversationVisibilityWhereInput(assignedOnly, VIEWER)).toEqual({
      OR: [{ client: { assignedToUserId: VIEWER } }, { clientId: null, assignedToUserId: VIEWER }],
    });
  });

  it("should hide unlinked leads from OPME-linked users", () => {
    expect(buildConversationVisibilityWhereInput(opme, VIEWER)).toEqual({
      client: { opmeSupplierId: "opme-1" },
    });
  });
});

describe("buildAgendaEventVisibilityWhereInput", () => {
  it("should not restrict admins", () => {
    expect(buildAgendaEventVisibilityWhereInput(admin, VIEWER)).toEqual({});
  });

  it("should fall back to owner for events with neither client nor conversation (assigned-only)", () => {
    const where = buildAgendaEventVisibilityWhereInput(assignedOnly, VIEWER);
    expect(where).toEqual({
      OR: [
        { client: { assignedToUserId: VIEWER } },
        { clientId: null, conversation: buildConversationVisibilityWhereInput(assignedOnly, VIEWER) },
        { clientId: null, conversationId: null, ownerUserId: VIEWER },
      ],
    });
  });

  it("should never expose ownerless-of-client events to OPME-linked users", () => {
    const where = buildAgendaEventVisibilityWhereInput(opme, VIEWER) as { OR: unknown[] };
    expect(where.OR).toHaveLength(2);
  });
});

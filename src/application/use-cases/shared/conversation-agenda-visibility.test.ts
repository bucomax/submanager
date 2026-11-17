import { describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/repositories/client.repository", () => ({ clientPrismaRepository: {} }));
vi.mock("@/infrastructure/repositories/tenant.repository", () => ({ tenantPrismaRepository: {} }));
vi.mock("@/infrastructure/repositories/user.repository", () => ({ userPrismaRepository: {} }));

const {
  buildAgendaEventVisibilityWhereInput,
  buildClientVisibilityFlatFilter,
  buildConversationVisibilityWhereInput,
} = await import("./load-client-visibility-scope");

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

describe("buildClientVisibilityFlatFilter", () => {
  it("should map scope to a flat filter", () => {
    expect(buildClientVisibilityFlatFilter(admin, VIEWER)).toEqual({ opmeSupplierId: null, assignedToUserId: null });
    expect(buildClientVisibilityFlatFilter(assignedOnly, VIEWER)).toEqual({
      opmeSupplierId: null,
      assignedToUserId: VIEWER,
    });
    expect(buildClientVisibilityFlatFilter(opme, VIEWER)).toEqual({ opmeSupplierId: "opme-1", assignedToUserId: null });
  });
});

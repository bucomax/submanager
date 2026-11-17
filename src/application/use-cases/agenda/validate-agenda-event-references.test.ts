import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  existsInTenant: vi.fn(),
  findClient: vi.fn(),
  findOwner: vi.fn(),
  visibility: { clientId: "visible-only" },
}));

vi.mock("@/application/use-cases/shared/load-client-visibility-scope", () => ({
  findTenantClientVisibleToSession: mocks.findClient,
  loadConversationVisibilityWhere: async () => mocks.visibility,
}));
vi.mock("@/infrastructure/repositories/conversation.repository", () => ({
  conversationPrismaRepository: { existsInTenant: mocks.existsInTenant },
}));
vi.mock("@/infrastructure/repositories/user.repository", () => ({
  userPrismaRepository: { findById: mocks.findOwner },
}));

const { validateAgendaEventRefs } = await import("./validate-agenda-event-references");
const session = { user: { id: "u1", globalRole: "user" } } as Session;

describe("validateAgendaEventRefs", () => {
  beforeEach(() => {
    mocks.existsInTenant.mockReset().mockResolvedValue(true);
    mocks.findClient.mockReset().mockResolvedValue({ id: "c1" });
    mocks.findOwner.mockReset().mockResolvedValue({ id: "u1" });
  });

  it("should return null when every reference is valid", async () => {
    expect(await validateAgendaEventRefs(session, "t1", { conversationId: "cv", clientId: "c1", ownerUserId: "u1" })).toBeNull();
  });

  it("should check the conversation against the visibility scope", async () => {
    mocks.existsInTenant.mockResolvedValue(false);
    expect(await validateAgendaEventRefs(session, "t1", { conversationId: "cv" })).toBe("conversation_not_found");
    expect(mocks.existsInTenant).toHaveBeenCalledWith("t1", "cv", mocks.visibility);
  });

  it("should reject a client outside the user scope", async () => {
    mocks.findClient.mockResolvedValue(null);
    expect(await validateAgendaEventRefs(session, "t1", { clientId: "c9" })).toBe("patient_not_found");
  });

  it("should reject an owner that is not a tenant member", async () => {
    mocks.findOwner.mockResolvedValue(null);
    expect(await validateAgendaEventRefs(session, "t1", { ownerUserId: "x" })).toBe("invalid_assignee");
  });
});

import { beforeEach, describe, expect, it } from "vitest";

import {
  createClientCrudDeps,
  createClientCrudWorld,
  fullClientRow,
  type ClientCrudWorld,
} from "@/application/testing/in-memory-client-crud";
import { createClient, type CreateClientBody } from "@/application/use-cases/client/create-client.core";
import { deleteClient } from "@/application/use-cases/client/delete-client.core";
import { listClientsPage } from "@/application/use-cases/client/list-clients-page.core";
import { updateClient } from "@/application/use-cases/client/update-client.core";
import type { Actor } from "@/domain/auth/actor";

const TENANT = "t1";
const OTHER_TENANT = "t2";
const ACTOR = "u-actor";

describe("client use cases", () => {
  let world: ClientCrudWorld;
  let deps: ReturnType<typeof createClientCrudDeps>;

  beforeEach(() => {
    world = createClientCrudWorld();
    world.clients.push(
      { ...fullClientRow({ id: "c-own" }), tenantId: TENANT, deletedAt: null },
      { ...fullClientRow({ id: "c-foreign" }), tenantId: OTHER_TENANT, deletedAt: null },
    );
    deps = createClientCrudDeps(world);
  });

  describe("createClient", () => {
    it("should persist under the context tenant, audit with ids only and revalidate the list", async () => {
      const data = { name: "Maria", phone: "11988887777", isMinor: false } as CreateClientBody;

      const { client } = await createClient({ tenantId: TENANT, actorUserId: ACTOR, data }, deps);

      expect(world.clients.find((c) => c.id === client.id)).toMatchObject({ tenantId: TENANT, name: "Maria" });
      expect(world.audits).toEqual([
        {
          tenantId: TENANT,
          clientId: client.id,
          patientPathwayId: null,
          actorUserId: ACTOR,
          type: "PATIENT_CREATED",
          payload: { clientId: client.id },
        },
      ]);
      expect(deps.cache.clientsListRevalidated).toEqual([TENANT]);
    });
  });

  describe("updateClient", () => {
    it("should reject an empty patch without writing, auditing or revalidating", async () => {
      const result = await updateClient({ tenantId: TENANT, actorUserId: ACTOR, clientDbId: "c-own", patch: {} }, deps);

      expect(result).toEqual({ ok: false, code: "NO_FIELDS_TO_UPDATE" });
      expect(world.audits).toEqual([]);
      expect(deps.cache.clientsListRevalidated).toEqual([]);
    });

    it("should trim fields, audit changed field names only and revalidate OPME only when it changed", async () => {
      const result = await updateClient(
        { tenantId: TENANT, actorUserId: ACTOR, clientDbId: "c-own", patch: { name: "  Ana  " } },
        deps,
      );

      expect(result).toMatchObject({ ok: true, client: { id: "c-own", name: "Ana" } });
      expect(world.audits[0]).toMatchObject({ type: "PATIENT_UPDATED", payload: { clientId: "c-own", changedFields: ["name"] } });
      expect(deps.cache.opmeSuppliersRevalidated).toEqual([]);

      await updateClient(
        { tenantId: TENANT, actorUserId: ACTOR, clientDbId: "c-own", patch: { opmeSupplierId: null } },
        deps,
      );
      expect(deps.cache.opmeSuppliersRevalidated).toEqual([TENANT]);
    });

    it("should clear guardian data when the patient stops being a minor", async () => {
      world.clients[0]!.guardianName = "Responsável";
      await updateClient({ tenantId: TENANT, actorUserId: ACTOR, clientDbId: "c-own", patch: { isMinor: false } }, deps);
      expect(world.clients[0]).toMatchObject({ isMinor: false, guardianName: null });
    });

    it("should not update a client from another tenant", async () => {
      await expect(
        updateClient({ tenantId: TENANT, actorUserId: ACTOR, clientDbId: "c-foreign", patch: { name: "X" } }, deps),
      ).rejects.toThrow();
      expect(world.clients[1]!.name).not.toBe("X");
      expect(world.audits).toEqual([]);
    });
  });

  describe("deleteClient", () => {
    const run = (clientDbId: string, isSuperAdmin = false) =>
      deleteClient({ tenantId: TENANT, actorUserId: ACTOR, clientDbId, isSuperAdmin }, deps);

    it("should forbid members that are not tenant admins", async () => {
      world.roles.set(`${TENANT}:${ACTOR}`, "tenant_user");
      expect(await run("c-own")).toEqual({ ok: false, code: "FORBIDDEN" });
      expect(world.clients[0]!.deletedAt).toBeNull();
      expect(world.audits).toEqual([]);
    });

    it("should soft delete as tenant admin, audit and revalidate both lists", async () => {
      world.roles.set(`${TENANT}:${ACTOR}`, "tenant_admin");
      expect(await run("c-own")).toEqual({ ok: true });
      expect(world.clients[0]!.deletedAt).not.toBeNull();
      expect(world.audits[0]).toMatchObject({ type: "PATIENT_DELETED", clientId: "c-own" });
      expect(deps.cache.clientsListRevalidated).toEqual([TENANT]);
      expect(deps.cache.opmeSuppliersRevalidated).toEqual([TENANT]);
    });

    it("should let super admins skip the membership check but still 404 on another tenant's client", async () => {
      expect(await run("c-own", true)).toEqual({ ok: true });
      expect(await run("c-foreign", true)).toEqual({ ok: false, code: "NOT_FOUND" });
      expect(world.clients[1]!.deletedAt).toBeNull();
    });
  });

  describe("listClientsPage", () => {
    const actor = (globalRole = "user"): Actor => ({ userId: ACTOR, globalRole, tenantId: TENANT, tenantRole: null });
    const query = { limit: 20, page: 1 } as Parameters<typeof listClientsPage>[0]["query"];

    it("should load the page with the actor's tenant and the restrictive scope when there is no membership", async () => {
      await listClientsPage({ tenantId: TENANT, actor: actor(), query }, deps);

      expect(world.listCalls[0]!.args).toMatchObject({
        tenantId: TENANT,
        viewerUserId: ACTOR,
        scope: { role: "tenant_user", restrictedToAssignedOnly: true },
      });
    });

    it("should give super admins an unrestricted scope", async () => {
      await listClientsPage({ tenantId: TENANT, actor: actor("super_admin"), query }, deps);
      expect(world.listCalls[0]!.args).toMatchObject({ scope: { role: "tenant_admin", restrictedToAssignedOnly: false } });
    });

    it("should scan in memory (not the page reader) when filtering by SLA status", async () => {
      world.scanRows = [fullClientRow({ id: "c-own" })];
      const statusQuery = { ...query, status: "completed" } as typeof query;

      const result = await listClientsPage({ tenantId: TENANT, actor: actor(), query: statusQuery }, deps);

      expect(result.data).toEqual([]);
      expect(result.pagination.totalItems).toBe(0);
      expect(world.listCalls).toEqual([]);
    });
  });
});

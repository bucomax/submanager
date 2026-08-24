import { beforeEach, describe, expect, it } from "vitest";
import * as Sentry from "@sentry/nextjs";
import {
  applySentryUserContext,
  clearSentryUserContext,
} from "@/lib/observability/sentry-context";

function currentTags() {
  return Sentry.getIsolationScope().getScopeData().tags;
}

describe("contexto do Sentry", () => {
  beforeEach(() => {
    Sentry.getIsolationScope().clear();
  });

  it("carimba tenant e papéis, sem nome nem e-mail", () => {
    applySentryUserContext({
      userId: "user-1",
      tenantId: "tenant-1",
      tenantRole: "tenant_admin",
      globalRole: "user",
      locale: "pt-BR",
    });

    expect(currentTags()).toMatchObject({
      "tenant.id": "tenant-1",
      "tenant.role": "tenant_admin",
      "global.role": "user",
      locale: "pt-BR",
    });
    expect(Sentry.getIsolationScope().getScopeData().user).toEqual({ id: "user-1" });
  });

  it("usa `none` quando o usuário não tem tenant ativo", () => {
    applySentryUserContext({
      userId: "user-1",
      tenantId: null,
      tenantRole: null,
      globalRole: "super_admin",
      locale: "en",
    });

    expect(currentTags()["tenant.id"]).toBe("none");
    expect(currentTags()["tenant.role"]).toBe("none");
  });

  it("limpa toda tag que o apply escreveu", () => {
    applySentryUserContext({
      userId: "user-1",
      tenantId: "tenant-1",
      tenantRole: "tenant_admin",
      globalRole: "user",
      locale: "pt-BR",
    });

    clearSentryUserContext();

    const remaining = Object.entries(currentTags()).filter(([, v]) => v !== undefined);
    expect(remaining).toEqual([]);
    // `setUser(null)` no SDK instalado não zera o campo `user` da scope para
    // `undefined`/`null` — deixa um objeto com todas as chaves `undefined`.
    // O que importa para LGPD é que nenhum id sobrevive ao clear.
    expect(Sentry.getIsolationScope().getScopeData().user?.id).toBeUndefined();
  });
});

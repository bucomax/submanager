import { beforeEach, describe, expect, it } from "vitest";
import { LAST_ERROR_TTL_MS, useLastErrorStore } from "@/shared/stores/use-last-error-store";

const BASE = 1_700_000_000_000;

function captured(capturedAt: number) {
  return {
    sentryEventId: "evt-1",
    requestId: "req-1",
    route: "/dashboard/clients",
    capturedAt,
  };
}

describe("useLastErrorStore", () => {
  beforeEach(() => {
    useLastErrorStore.getState().clearLastError();
  });

  it("começa vazio", () => {
    expect(useLastErrorStore.getState().lastError).toBeNull();
  });

  it("devolve o erro dentro da janela de validade", () => {
    useLastErrorStore.getState().setLastError(captured(BASE));

    expect(useLastErrorStore.getState().readFreshError(BASE + 60_000)).toEqual(
      captured(BASE),
    );
  });

  it("descarta erro além do TTL", () => {
    useLastErrorStore.getState().setLastError(captured(BASE));

    expect(
      useLastErrorStore.getState().readFreshError(BASE + LAST_ERROR_TTL_MS + 1),
    ).toBeNull();
  });

  it("mantém apenas o erro mais recente", () => {
    useLastErrorStore.getState().setLastError(captured(BASE));
    useLastErrorStore.getState().setLastError({ ...captured(BASE + 1), sentryEventId: "evt-2" });

    expect(useLastErrorStore.getState().lastError?.sentryEventId).toBe("evt-2");
  });
});

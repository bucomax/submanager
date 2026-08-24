import { beforeEach, describe, expect, it } from "vitest";
import * as Sentry from "@sentry/nextjs";
import {
  REQUEST_ID_HEADER,
  currentRequestId,
  resolveRequestId,
  tagRequestId,
} from "@/lib/observability/request-id";

describe("resolveRequestId", () => {
  it("reaproveita o header quando presente", () => {
    const request = new Request("https://app.local/api/v1/feedback", {
      headers: { [REQUEST_ID_HEADER]: "abc-123" },
    });

    expect(resolveRequestId(request)).toBe("abc-123");
  });

  it("gera um id quando o header falta", () => {
    const request = new Request("https://app.local/api/v1/feedback");

    expect(resolveRequestId(request)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("ignora header vazio", () => {
    const request = new Request("https://app.local/api/v1/feedback", {
      headers: { [REQUEST_ID_HEADER]: "   " },
    });

    expect(resolveRequestId(request)).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("tagRequestId", () => {
  beforeEach(() => {
    Sentry.getIsolationScope().clear();
  });

  it("grava a tag e devolve o id", () => {
    const request = new Request("https://app.local/api/v1/feedback", {
      headers: { [REQUEST_ID_HEADER]: "req-1" },
    });

    expect(tagRequestId(request)).toBe("req-1");
    expect(currentRequestId()).toBe("req-1");
  });

  it("devolve null sem request, sem sujar a scope", () => {
    expect(tagRequestId(undefined)).toBeNull();
    expect(currentRequestId()).toBeNull();
  });
});

describe("currentRequestId", () => {
  it("devolve null quando nada foi marcado", () => {
    Sentry.getIsolationScope().clear();

    expect(currentRequestId()).toBeNull();
  });
});

import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@/lib/api-response", () => ({
  jsonError: (code: string, message: string, status: number) => Response.json({ code, message }, { status }),
}));

import { parseJsonBody, readJsonBody } from "./parse-json-body";
import { zodApiMsg } from "./zod-i18n";

const apiT = ((key: string) => `t:${key}`) as never;
const schema = z.object({ name: z.string().min(1, zodApiMsg("errors.nameRequired")), age: z.number() });

function post(body: string) {
  return new Request("http://localhost/x", { method: "POST", body });
}

describe("parseJsonBody", () => {
  it("returns parsed data on valid input", async () => {
    const result = await parseJsonBody(post(JSON.stringify({ name: "Ana", age: 3 })), schema, apiT);
    expect(result.response).toBeUndefined();
    expect(result.data).toEqual({ name: "Ana", age: 3 });
  });

  it("returns INVALID_JSON (400) for malformed JSON", async () => {
    const result = await parseJsonBody(post("{oops"), schema, apiT);
    expect(result.response?.status).toBe(400);
    expect(await result.response?.json()).toEqual({ code: "INVALID_JSON", message: "t:errors.invalidJson" });
  });

  it("returns VALIDATION_ERROR (422) with translated issues by default", async () => {
    const result = await parseJsonBody(post(JSON.stringify({ name: "", age: 1 })), schema, apiT);
    expect(result.response?.status).toBe(422);
    expect(await result.response?.json()).toEqual({ code: "VALIDATION_ERROR", message: "t:errors.nameRequired" });
  });

  it("formats issues as `field: message` with issues: fields", async () => {
    const result = await parseJsonBody(post(JSON.stringify({ name: "x", age: "no" })), schema, apiT, {
      issues: "fields",
    });
    const body = (await result.response?.json()) as { code: string; message: string };
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.message.startsWith("age: ")).toBe(true);
  });

  it("allowEmptyBody treats blank body as {} but still rejects malformed JSON", async () => {
    const optional = z.object({ flag: z.boolean().optional() });
    const empty = await parseJsonBody(post("  "), optional, apiT, { allowEmptyBody: true });
    expect(empty.data).toEqual({});
    const broken = await parseJsonBody(post("{"), optional, apiT, { allowEmptyBody: true });
    expect(broken.response?.status).toBe(400);
  });
});

describe("readJsonBody", () => {
  it("returns raw data without validating", async () => {
    const result = await readJsonBody(post('{"a":1}'), apiT);
    expect(result.data).toEqual({ a: 1 });
  });
});

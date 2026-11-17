import { describe, expect, it } from "vitest";

import { hashAuthToken } from "./auth-token-hash";

describe("hashAuthToken", () => {
  it("returns deterministic sha256 hex different from the raw token", () => {
    const h = hashAuthToken("abc");
    expect(h).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(hashAuthToken("abc")).toBe(h);
  });
});

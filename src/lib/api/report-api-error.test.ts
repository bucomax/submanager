import { describe, expect, it } from "vitest";
import { buildApiErrorFingerprint } from "@/lib/api/report-api-error";

describe("buildApiErrorFingerprint", () => {
  it("agrupa por método, rota e código", () => {
    expect(buildApiErrorFingerprint("post", "/api/v1/clients", "INTERNAL_ERROR")).toEqual([
      "api-client",
      "post",
      "/api/v1/clients",
      "INTERNAL_ERROR",
    ]);
  });

  it("não inclui mensagem, que varia com o locale e espalharia o mesmo defeito", () => {
    const fingerprint = buildApiErrorFingerprint("get", "/api/v1/clients", "INTERNAL_ERROR");

    // Só identificadores (método, rota, código): nenhuma parte é texto livre com
    // espaço, o que denunciaria uma mensagem humana (varia por locale) colada aqui.
    expect(fingerprint).toHaveLength(4);
    expect(fingerprint.every((part) => !part.includes(" "))).toBe(true);
  });
});

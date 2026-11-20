import { describe, expect, it } from "vitest";

import { OVERRIDE_REASON_MIN_LENGTH } from "@/domain/pathway/stage-transition-rules";

import { postStageTransitionBodySchema } from "./pathway";

const toStageId = "cjld2cjxh0000qzrmn831i7rn";

describe("postStageTransitionBodySchema", () => {
  it("should accept a plain transition without force", () => {
    expect(postStageTransitionBodySchema.safeParse({ toStageId }).success).toBe(true);
  });

  it.each([undefined, "", "   ", "x".repeat(OVERRIDE_REASON_MIN_LENGTH - 1)])(
    "should reject force without a sufficient override reason (%j)",
    (overrideReason) => {
      const result = postStageTransitionBodySchema.safeParse({ toStageId, force: true, overrideReason });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]).toMatchObject({ path: ["overrideReason"] });
    },
  );

  it("should accept force with a justified override reason", () => {
    const body = { toStageId, force: true, overrideReason: "x".repeat(OVERRIDE_REASON_MIN_LENGTH) };
    expect(postStageTransitionBodySchema.safeParse(body).success).toBe(true);
  });
});

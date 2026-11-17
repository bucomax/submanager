import { describe, expect, it } from "vitest";

import { isBlockedIp } from "./smtp-host-guard";
import { isAllowedSmtpPort } from "@/lib/constants/smtp";

describe("isBlockedIp", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.5",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "::",
    "fe80::1",
    "fd00::1",
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
    "not-an-ip",
  ])("blocks %s", (ip) => {
    expect(isBlockedIp(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "142.250.80.5", "2607:f8b0:4004:c1b::1a"])("allows %s", (ip) => {
    expect(isBlockedIp(ip)).toBe(false);
  });
});

describe("isAllowedSmtpPort", () => {
  it("allows only mail ports", () => {
    expect([25, 465, 587, 2525].every(isAllowedSmtpPort)).toBe(true);
    expect([22, 80, 3306, 6379].some(isAllowedSmtpPort)).toBe(false);
  });
});

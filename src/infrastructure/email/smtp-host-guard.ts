import { lookup } from "dns/promises";
import { BlockList, isIP } from "net";

// Listas separadas: o BlockList do Node trata IPv4 como IPv4-mapped ao avaliar regras IPv6.
const blockedV4 = new BlockList();
const blockedV6 = new BlockList();

const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

const BLOCKED_V6: Array<[string, number]> = [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
];

for (const [net, prefix] of BLOCKED_V4) blockedV4.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of BLOCKED_V6) blockedV6.addSubnet(net, prefix, "ipv6");

/** true se o IP (v4/v6, incl. IPv4-mapped) é interno/reservado e não deve ser alvo de SMTP. */
export function isBlockedIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 0) return true;
  return family === 4 ? blockedV4.check(ip, "ipv4") : blockedV6.check(ip, "ipv6");
}

export class SmtpHostNotAllowedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "SmtpHostNotAllowedError";
  }
}

/**
 * Resolve o host e rejeita se qualquer endereço for interno. Retorna um IP público
 * para a conexão ser fixada nele (anti DNS rebinding).
 */
export async function resolvePublicSmtpHost(host: string): Promise<string> {
  const addresses = await lookup(host, { all: true, verbatim: true });
  if (addresses.length === 0) {
    throw new SmtpHostNotAllowedError("host_unresolved");
  }
  if (addresses.some((a) => isBlockedIp(a.address))) {
    throw new SmtpHostNotAllowedError("host_blocked");
  }
  return addresses[0]!.address;
}

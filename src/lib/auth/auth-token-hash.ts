import { createHash } from "crypto";

/** sha256 hex do token de reset/convite — só o hash é persistido; o token cru vai apenas no link do e-mail. */
export function hashAuthToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

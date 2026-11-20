/**
 * Define o passo exibido após informar CPF/e-mail: `true` = pedir senha; `false` = ir direto ao código (OTP).
 *
 * Login inexistente responde `true`, igual a quem tem senha: o atacante não distingue "CPF não cadastrado"
 * de "CPF com senha". A UX segue válida: a tentativa de senha falha e o paciente usa "esqueci a senha"
 * (OTP, que já responde de forma opaca). Resíduo conhecido: paciente existente sem senha ainda responde `false`.
 */
export function resolvePortalLoginHasPassword(client: { portalPasswordHash: string | null } | null): boolean {
  if (!client) return true;
  return Boolean(client.portalPasswordHash);
}

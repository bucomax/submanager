import bcrypt from "bcryptjs";

/**
 * Hash descartável (cost 12, igual ao dos hashes reais). Serve só para gastar o mesmo tempo de CPU
 * quando o login/CPF não existe, não tem senha ou está bloqueado — sem isso a latência revela quais existem.
 */
const DUMMY_PASSWORD_HASH = "$2a$12$xj6MdirVeyFWWlipr.PIi.oaDzgSVSsuv45DRop9zTXCfjVZwr9qu";

/** Executa um `bcrypt.compare` contra o hash fictício (resultado sempre descartado). */
export async function spendPasswordCompareTime(password: string): Promise<void> {
  await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
}

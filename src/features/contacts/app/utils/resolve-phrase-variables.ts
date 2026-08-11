export type PhraseVariableContext = {
  nome: string;
  medico: string;
  data: string;
};

/** Substitui `{{nome}}`, `{{medico}}`, `{{data}}` no corpo de uma frase pronta. Variável sem valor vira string vazia. */
export function resolvePhraseVariables(body: string, ctx: PhraseVariableContext): string {
  return body
    .replaceAll("{{nome}}", ctx.nome)
    .replaceAll("{{medico}}", ctx.medico)
    .replaceAll("{{data}}", ctx.data);
}

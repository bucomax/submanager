/** Mantém apenas dígitos de CEP (máx. 8). */
export function digitsOnlyCep(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8);
}

/** Formata CEP para exibição: 00000-000 */
export function formatCepDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

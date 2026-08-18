/** {@code amountMinor} é sempre a menor unidade da moeda (ver ADR 0027, item 9) — nunca um valor
 * decimal. A imensa maioria das moedas ISO 4217 usa 2 dígitos decimais (BRL/USD/EUR); moedas com
 * outro número de dígitos (ex.: JPY com 0) exigiriam um mapa de exponentes — fora de escopo hoje,
 * já que só BRL/USD/EUR são usadas nesta fase. */
export function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amountMinor / 100)
}

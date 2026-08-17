export type WipStatus = 'UNLIMITED' | 'AVAILABLE' | 'AT_LIMIT' | 'OVER_LIMIT'

/** Sempre derivado, nunca persistido (ver ADR 0017) — mesma regra usada pelo enforcement real de
 * `CardService#move` no backend (`count >= wipLimit` bloqueia entrada). */
export function resolveWipStatus(wipLimit: number | null, cardCount: number): WipStatus {
  if (wipLimit == null) return 'UNLIMITED'
  if (cardCount > wipLimit) return 'OVER_LIMIT'
  if (cardCount === wipLimit) return 'AT_LIMIT'
  return 'AVAILABLE'
}

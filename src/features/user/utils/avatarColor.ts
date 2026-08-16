/** Paleta fixa e discreta — evita cores fortes demais no avatar (ver Prompt 12). */
const AVATAR_COLOR_PALETTE = [
  '#F87171',
  '#FB923C',
  '#FBBF24',
  '#A3E635',
  '#34D399',
  '#22D3EE',
  '#60A5FA',
  '#818CF8',
  '#C084FC',
  '#F472B6',
]

/** Cor estável derivada do id do usuário — nunca persistida, sempre recalculada (mesma filosofia de contrastColor). */
export function getAvatarColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  const index = Math.abs(hash) % AVATAR_COLOR_PALETTE.length
  return AVATAR_COLOR_PALETTE[index] ?? '#94A3B8'
}

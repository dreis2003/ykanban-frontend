/**
 * Deriva a cor do texto (preto ou branco) a partir da luminância relativa da cor de fundo
 * (fórmula WCAG) — nunca persistido, sempre recalculado na renderização (ver ADR 0011).
 */
export function getContrastTextColor(hexColor: string): '#000000' | '#ffffff' {
  const luminance = relativeLuminance(hexColor)
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

function relativeLuminance(hexColor: string): number {
  const [r, g, b] = hexToRgb(hexColor)
  return 0.2126 * toLinearChannel(r) + 0.7152 * toLinearChannel(g) + 0.0722 * toLinearChannel(b)
}

function hexToRgb(hexColor: string): [number, number, number] {
  const value = hexColor.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return [r, g, b]
}

function toLinearChannel(channel: number): number {
  const normalized = channel / 255
  return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4)
}

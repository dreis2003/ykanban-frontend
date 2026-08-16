/** Sempre derivado do nome, nunca persistido. Ex.: "Daniel Mitsuo Reis" -> "DR", "Maria" -> "M". */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return ''
  }
  const first = parts[0]
  const last = parts[parts.length - 1]
  if (!first) {
    return ''
  }
  if (parts.length === 1 || !last) {
    return first.charAt(0).toUpperCase()
  }
  return (first.charAt(0) + last.charAt(0)).toUpperCase()
}

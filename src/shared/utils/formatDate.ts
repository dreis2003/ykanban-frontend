export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

/** "14/08/2026 às 19:30" — usado onde o horário importa (ex.: quando um Card foi bloqueado). */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  const datePart = date.toLocaleDateString('pt-BR')
  const timePart = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${datePart} às ${timePart}`
}

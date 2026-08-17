const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3600
const SECONDS_PER_DAY = 86400

/** "5d 4h" / "3h 20min" / "45min" — usado para Lead Time/Cycle Time (ver ADR 0018). Nunca chamado
 * com {@code null} pelo componente: sample vazio mostra "Dados insuficientes" em vez de "0h". */
export function formatSecondsAsDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const days = Math.floor(seconds / SECONDS_PER_DAY)
  const hours = Math.floor((seconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR)
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`
  }
  return `${minutes}min`
}

/** "há 4 dias" / "há 6 horas" / "há alguns minutos" — usado na lista de bloqueados mais antigos. */
export function formatRelativeAge(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  const days = Math.floor(seconds / SECONDS_PER_DAY)
  if (days > 0) {
    return `há ${days} dia${days === 1 ? '' : 's'}`
  }
  const hours = Math.floor(seconds / SECONDS_PER_HOUR)
  if (hours > 0) {
    return `há ${hours} hora${hours === 1 ? '' : 's'}`
  }
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE)
  if (minutes > 0) {
    return `há ${minutes} minuto${minutes === 1 ? '' : 's'}`
  }
  return 'há poucos instantes'
}

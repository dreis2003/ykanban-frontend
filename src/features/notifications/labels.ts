const DISPATCH_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  PROCESSING: 'Enviando',
  DISPATCHED: 'Aceito pelo YCommunication',
  FAILED: 'Falha ao enviar ao Hub',
  DEAD_LETTER: 'Falha definitiva ao enviar ao Hub',
}

const REMOTE_STATUS_LABELS: Record<string, string> = {
  SENT: 'Enviado',
  DELIVERED: 'Entregue',
  READ: 'Lido',
  FAILED: 'Falhou',
  DEAD_LETTER: 'Dead Letter',
}

/** dispatchStatus é sempre um valor conhecido (fechado no backend), mas o fallback nunca quebra a
 * UI mesmo assim caso um novo status seja introduzido no backend antes do frontend. */
export function dispatchStatusLabel(status: string): string {
  return DISPATCH_STATUS_LABELS[status] ?? status
}

/** remoteStatus NÃO tem enum fechado no backend (vem de um payload assinado externo) — sempre trata
 * como string livre; um valor desconhecido é exibido cru como fallback seguro, nunca esconde a UI. */
export function remoteStatusLabel(status: string | null): string {
  if (status === null) {
    return 'Aguardando atualização'
  }
  return REMOTE_STATUS_LABELS[status] ?? status
}

import { CARD_PRIORITY_LABELS, CARD_TYPE_LABELS } from '@/features/card/labels'
import type { CardHistoryEvent } from '@/features/card/types'

export interface FormattedHistoryEvent {
  title: string
  detail: string | null
}

const FIELD_LABELS: Record<string, string> = {
  title: 'título',
  description: 'descrição',
  type: 'tipo',
  priority: 'prioridade',
}

function actorName(event: CardHistoryEvent): string {
  return event.actor?.name ?? 'Alguém'
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function translatedValue(field: string, rawValue: unknown): string {
  const value = asString(rawValue)
  if (field === 'type') return CARD_TYPE_LABELS[value as keyof typeof CARD_TYPE_LABELS] ?? value
  if (field === 'priority') return CARD_PRIORITY_LABELS[value as keyof typeof CARD_PRIORITY_LABELS] ?? value
  return value
}

function formatCardUpdated(metadata: Record<string, unknown>, actor: string): FormattedHistoryEvent {
  const changes = asRecord(metadata.changes)
  const fields = Object.keys(changes)

  if (fields.length === 1) {
    const field = fields[0] as string
    const label = FIELD_LABELS[field] ?? field
    if (field === 'description') {
      return { title: `${actor} atualizou a descrição.`, detail: null }
    }
    const change = asRecord(changes[field])
    const from = translatedValue(field, change.from)
    const to = translatedValue(field, change.to)
    return { title: `${actor} alterou ${field === 'title' ? 'o título' : `a ${label}`}`, detail: `${from} → ${to}` }
  }

  const labels = fields.map((field) => FIELD_LABELS[field] ?? field)
  const fieldList =
    labels.length <= 1
      ? labels.join('')
      : `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`
  return { title: `${actor} atualizou o card`, detail: `${fieldList} foram alterados.` }
}

function formatCardMoved(metadata: Record<string, unknown>, actor: string): FormattedHistoryEvent {
  const sourceColumnType = asString(metadata.sourceColumnType)
  const targetColumnType = asString(metadata.targetColumnType)
  if (sourceColumnType && sourceColumnType === targetColumnType) {
    return {
      title: `${actor} reordenou o card`,
      detail: `posição ${metadata.sourcePosition} → ${metadata.targetPosition}`,
    }
  }
  return {
    title: `${actor} moveu o card`,
    detail: `${asString(metadata.sourceColumnName)} → ${asString(metadata.targetColumnName)}`,
  }
}

function formatAssigneeChanged(metadata: Record<string, unknown>, actor: string): FormattedHistoryEvent {
  const from = metadata.from ? asRecord(metadata.from) : null
  const to = metadata.to ? asRecord(metadata.to) : null
  if (!from && to) {
    return { title: `${actor} atribuiu o card a ${asString(to.name)}.`, detail: null }
  }
  if (from && !to) {
    return { title: `${actor} removeu o responsável ${asString(from.name)}.`, detail: null }
  }
  if (from && to) {
    return { title: `${actor} alterou o responsável`, detail: `${asString(from.name)} → ${asString(to.name)}` }
  }
  return { title: `${actor} alterou o responsável do card.`, detail: null }
}

/**
 * Centraliza eventType + metadata → frase em PT-BR — nunca espalhar esse mapeamento em vários
 * componentes (ver agent_docs/decisions/0015-card-history.md). Eventos desconhecidos (backend novo,
 * frontend ainda não atualizado) caem no fallback genérico em vez de quebrar a timeline inteira.
 */
export function formatHistoryEvent(event: CardHistoryEvent): FormattedHistoryEvent {
  const actor = actorName(event)
  const metadata = event.metadata ?? {}

  switch (event.eventType) {
    case 'CARD_CREATED':
      return { title: `${actor} criou o card ${asString(metadata.key)}.`, detail: null }
    case 'CARD_UPDATED':
      return formatCardUpdated(metadata, actor)
    case 'CARD_MOVED':
      return formatCardMoved(metadata, actor)
    case 'CARD_BLOCKED':
      return { title: `${actor} bloqueou o card`, detail: asString(metadata.reason) }
    case 'CARD_UNBLOCKED':
      return { title: `${actor} desbloqueou o card.`, detail: null }
    case 'ASSIGNEE_CHANGED':
      return formatAssigneeChanged(metadata, actor)
    case 'LABEL_ADDED':
      return { title: `${actor} adicionou a label ${asString(metadata.labelName)}.`, detail: null }
    case 'LABEL_REMOVED':
      return { title: `${actor} removeu a label ${asString(metadata.labelName)}.`, detail: null }
    case 'ACCEPTANCE_CRITERION_ADDED':
      return { title: `${actor} adicionou um critério de aceite.`, detail: asString(metadata.description) || null }
    case 'ACCEPTANCE_CRITERION_UPDATED':
      return { title: `${actor} atualizou um critério de aceite.`, detail: asString(metadata.to) || null }
    case 'ACCEPTANCE_CRITERION_COMPLETED':
      return { title: `${actor} concluiu o critério:`, detail: asString(metadata.description) }
    case 'ACCEPTANCE_CRITERION_REOPENED':
      return { title: `${actor} reabriu o critério:`, detail: asString(metadata.description) }
    case 'ACCEPTANCE_CRITERION_REMOVED':
      return { title: `${actor} removeu um critério de aceite:`, detail: asString(metadata.description) }
    case 'ACCEPTANCE_CRITERION_MOVED':
      return {
        title: `${actor} reordenou um critério de aceite`,
        detail: `posição ${metadata.sourcePosition} → ${metadata.targetPosition}`,
      }
    case 'COMMENT_ADDED':
      return { title: `${actor} adicionou um comentário.`, detail: null }
    case 'COMMENT_UPDATED':
      return { title: `${actor} editou um comentário.`, detail: null }
    case 'COMMENT_REMOVED':
      return { title: `${actor} removeu um comentário.`, detail: null }
    default:
      return { title: 'Atividade registrada.', detail: null }
  }
}

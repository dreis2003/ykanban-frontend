import type { CardPriority, CardType } from '@/features/card/types'

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  FEATURE: 'Funcionalidade',
  BUG: 'Bug',
  REFACTOR: 'Refatoração',
  TECH: 'Técnica',
  SPIKE: 'Spike',
}

export const CARD_PRIORITY_LABELS: Record<CardPriority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
}

export const CARD_TYPE_OPTIONS: { value: CardType; label: string }[] = (
  Object.keys(CARD_TYPE_LABELS) as CardType[]
).map((value) => ({ value, label: CARD_TYPE_LABELS[value] }))

export const CARD_PRIORITY_OPTIONS: { value: CardPriority; label: string }[] = (
  Object.keys(CARD_PRIORITY_LABELS) as CardPriority[]
).map((value) => ({ value, label: CARD_PRIORITY_LABELS[value] }))

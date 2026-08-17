import type { CardPriority, CardType } from '@/features/card/types'

export type MetricsPeriod = '7d' | '30d' | '90d' | 'all'

export interface ColumnMetric {
  columnId: string
  columnType: string
  columnName: string
  position: number
  cardCount: number
}

export interface AssigneeMetric {
  assigneeId: string | null
  assigneeName: string | null
  inactive: boolean
  cardCount: number
}

export interface ColumnWipMetric {
  columnId: string
  columnName: string
  wipLimit: number
  cardCount: number
}

export interface BlockedCardMetric {
  cardId: string
  cardKey: string
  cardTitle: string
  blockedAt: string
}

/** Estado ATUAL do Project — nunca muda com o período das métricas de fluxo (ver ADR 0018). */
export interface CurrentMetrics {
  totalCards: number
  doingCards: number
  blockedCards: number
  unassignedCards: number
  productionCards: number
  byColumn: ColumnMetric[]
  byType: Partial<Record<CardType, number>>
  byPriority: Partial<Record<CardPriority, number>>
  byAssignee: AssigneeMetric[]
  wip: ColumnWipMetric[]
  oldestBlockedCards: BlockedCardMetric[]
}

export interface ThroughputPoint {
  bucketStart: string
  count: number
}

export interface ThroughputMetric {
  count: number
  previousCount: number | null
  series: ThroughputPoint[]
}

/** `averageSeconds`/`medianSeconds` nulos quando `sampleSize === 0` — nunca renderizar como "0h"
 * (ver ADR 0018): significa "sem dados suficientes", não "levou zero tempo". */
export interface DurationMetric {
  sampleSize: number
  averageSeconds: number | null
  medianSeconds: number | null
}

export interface FlowMetrics {
  period: MetricsPeriod
  throughput: ThroughputMetric
  leadTime: DurationMetric
  cycleTime: DurationMetric
}

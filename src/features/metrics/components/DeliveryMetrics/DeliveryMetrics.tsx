import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DurationMetric, FlowMetrics } from '@/features/metrics/types'
import { formatSecondsAsDuration } from '@/features/metrics/utils/formatDuration'
import styles from './DeliveryMetrics.module.css'

interface Props {
  flow: FlowMetrics
}

function formatBucketLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

interface TooltipPayloadItem {
  value: number
  payload: { label: string }
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload || payload.length === 0) return null
  const item = payload[0]
  if (!item) return null
  return (
    <div className={styles.tooltip}>
      <strong>{item.payload.label}</strong>
      <span>
        {item.value} card{item.value === 1 ? '' : 's'}
      </span>
    </div>
  )
}

function DurationCard({ title, metric }: { title: string; metric: DurationMetric }) {
  if (metric.sampleSize === 0) {
    return (
      <div className={styles.durationCard}>
        <span className={styles.durationTitle}>{title}</span>
        <p className={styles.insufficientData}>Ainda não há histórico suficiente.</p>
      </div>
    )
  }
  return (
    <div className={styles.durationCard}>
      <span className={styles.durationTitle}>{title}</span>
      <dl className={styles.durationStats}>
        <div>
          <dt>Média</dt>
          <dd>{formatSecondsAsDuration(metric.averageSeconds ?? 0)}</dd>
        </div>
        <div>
          <dt>Mediana</dt>
          <dd>{formatSecondsAsDuration(metric.medianSeconds ?? 0)}</dd>
        </div>
      </dl>
      <span className={styles.sampleSize}>
        Baseado em {metric.sampleSize} card{metric.sampleSize === 1 ? '' : 's'} concluído
        {metric.sampleSize === 1 ? '' : 's'}
      </span>
    </div>
  )
}

/**
 * Throughput/Lead Time/Cycle Time — sempre derivados de {@code CardHistory}, nunca de
 * {@code Card.updatedAt} (ver ADR 0018). Amostra zero nunca vira "0h": mostra texto explícito de
 * dados insuficientes.
 */
export function DeliveryMetrics({ flow }: Props) {
  const seriesData = flow.throughput.series.map((point) => ({
    label: formatBucketLabel(point.bucketStart),
    count: point.count,
  }))
  const trend =
    flow.throughput.previousCount != null ? flow.throughput.count - flow.throughput.previousCount : null

  return (
    <div className={styles.grid}>
      <div className={styles.throughputCard}>
        <span className={styles.durationTitle}>Throughput</span>
        <span className={styles.throughputValue}>{flow.throughput.count}</span>
        <span className={styles.throughputDescription}>
          card{flow.throughput.count === 1 ? '' : 's'} chegaram à produção no período
          {trend != null ? (
            <>
              {' · '}
              <span data-trend={trend >= 0 ? 'up' : 'down'}>
                {trend >= 0 ? '+' : ''}
                {trend} vs. período anterior
              </span>
            </>
          ) : null}
        </span>
        {seriesData.length > 0 ? (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={seriesData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} width={24} tick={{ fontSize: 10 }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" fill="var(--color-accent)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : null}
      </div>

      <DurationCard title="Lead Time" metric={flow.leadTime} />
      <DurationCard title="Cycle Time" metric={flow.cycleTime} />
    </div>
  )
}

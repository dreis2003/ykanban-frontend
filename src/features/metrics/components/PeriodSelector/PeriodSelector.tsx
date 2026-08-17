import type { MetricsPeriod } from '@/features/metrics/types'
import styles from './PeriodSelector.module.css'

interface Props {
  value: MetricsPeriod
  onChange: (period: MetricsPeriod) => void
}

const OPTIONS: { value: MetricsPeriod; label: string }[] = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: 'all', label: 'Todo período' },
]

/** Afeta só as métricas de fluxo (throughput/lead time/cycle time) — nunca os KPIs de estado
 * atual, que representam "agora" (ver ADR 0018). */
export function PeriodSelector({ value, onChange }: Props) {
  return (
    <div className={styles.group} role="radiogroup" aria-label="Período das métricas de fluxo">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={styles.option}
          data-active={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

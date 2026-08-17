import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ColumnMetric } from '@/features/metrics/types'
import styles from './ColumnDistributionChart.module.css'

interface Props {
  columns: ColumnMetric[]
}

interface TooltipPayloadItem {
  value: number
  payload: { name: string }
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload || payload.length === 0) return null
  const item = payload[0]
  if (!item) return null
  return (
    <div className={styles.tooltip}>
      <strong>{item.payload.name}</strong>
      <span>{item.value} cards</span>
    </div>
  )
}

/** {@code columns} já vem ordenado por `position` do chamador — nunca reordenar aqui (ver
 * agent_docs/business-rules.md). Uma lista textual equivalente acompanha o gráfico (oculta
 * visualmente, mas presente no DOM) para quem depende de leitor de tela (ver ADR 0018). */
export function ColumnDistributionChart({ columns }: Props) {
  const data = columns.map((column) => ({ name: column.columnName, cards: column.cardCount }))

  return (
    <div className={styles.wrapper}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} />
          <YAxis allowDecimals={false} width={32} tick={{ fontSize: 11 }} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="cards" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <ul className={styles.srOnly}>
        {columns.map((column) => (
          <li key={column.columnId}>
            {column.columnName}: {column.cardCount} cards
          </li>
        ))}
      </ul>
    </div>
  )
}

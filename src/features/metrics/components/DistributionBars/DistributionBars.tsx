import styles from './DistributionBars.module.css'

export interface DistributionItem {
  key: string
  label: string
  count: number
  inactive?: boolean
}

interface Props {
  title: string
  items: DistributionItem[]
  emptyMessage?: string
}

/**
 * Barras horizontais simples (não uma biblioteca de gráfico) — o valor numérico sempre acompanha
 * a barra como texto, nunca só a proporção visual (ver ADR 0018 e agent_docs sobre acessibilidade
 * de gráficos). Reaproveitada para Tipo/Prioridade/Responsável: mesma estrutura, evita pizza com
 * muitas cores para listas longas de responsáveis.
 */
export function DistributionBars({ title, items, emptyMessage }: Props) {
  const total = items.reduce((sum, item) => sum + item.count, 0)
  const maxCount = Math.max(1, ...items.map((item) => item.count))

  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>{title}</h3>
      {total === 0 ? (
        <p className={styles.empty}>{emptyMessage ?? 'Nenhum dado.'}</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.key} className={styles.row}>
              <span className={styles.label}>
                {item.label}
                {item.inactive ? <span className={styles.inactiveTag}>Inativo</span> : null}
              </span>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${(item.count / maxCount) * 100}%` }} />
              </div>
              <span className={styles.count}>{item.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

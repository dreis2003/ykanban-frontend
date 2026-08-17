import { Link } from 'react-router-dom'
import styles from './KpiCard.module.css'

interface Props {
  title: string
  value: number | string
  description?: string
  to?: string
}

/** {@code to} opcional aproveita os filtros do Board (Prompt 16) — ex.: "Bloqueados" navega para
 * `?blocked=true` em vez de reimplementar uma busca paralela (ver ADR 0018). */
export function KpiCard({ title, value, description, to }: Props) {
  const content = (
    <>
      <span className={styles.title}>{title}</span>
      <span className={styles.value}>{value}</span>
      {description ? <span className={styles.description}>{description}</span> : null}
    </>
  )
  if (to) {
    return (
      <Link to={to} className={styles.cardLink}>
        {content}
      </Link>
    )
  }
  return <div className={styles.card}>{content}</div>
}

import type { ReactNode } from 'react'
import { AlertCircle, Inbox, Loader2 } from 'lucide-react'
import styles from './StatusMessage.module.css'

type Variant = 'loading' | 'error' | 'empty'

interface Props {
  variant: Variant
  title: string
  description?: string
  action?: ReactNode
}

const ICONS: Record<Variant, typeof Loader2> = {
  loading: Loader2,
  error: AlertCircle,
  empty: Inbox,
}

/**
 * Padrão compartilhado para os três estados não-felizes de uma tela assíncrona:
 * carregando, erro e vazio. Cor nunca é o único indicador — ícone e texto sempre
 * acompanham a variante.
 */
export function StatusMessage({ variant, title, description, action }: Props) {
  const Icon = ICONS[variant]
  const role = variant === 'error' ? 'alert' : 'status'

  return (
    <div className={styles.container} data-variant={variant} role={role}>
      <Icon
        className={variant === 'loading' ? styles.iconSpin : styles.icon}
        size={28}
        aria-hidden="true"
      />
      <p className={styles.title}>{title}</p>
      {description ? <p className={styles.description}>{description}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  )
}

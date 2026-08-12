import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { checkBackendHealth } from '@/shared/api/healthCheck'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './HomePage.module.css'

type ConnectivityState =
  | { status: 'loading' }
  | { status: 'online'; backendStatus: string }
  | { status: 'offline'; message: string }

export function HomePage() {
  const [connectivity, setConnectivity] = useState<ConnectivityState>({ status: 'loading' })

  // Não define o estado "loading" aqui de forma síncrona: o valor inicial de
  // useState já cobre a checagem disparada no mount. Um novo "loading" síncrono
  // só acontece a partir do clique em "Tentar novamente" (fora de um Effect).
  const runHealthCheck = useCallback((signal?: AbortSignal) => {
    checkBackendHealth(signal)
      .then((health) => {
        setConnectivity({ status: 'online', backendStatus: health.status })
      })
      .catch((error: unknown) => {
        if (signal?.aborted) return
        const message = error instanceof Error ? error.message : 'Falha desconhecida.'
        setConnectivity({ status: 'offline', message })
      })
  }, [])

  const retry = useCallback(() => {
    setConnectivity({ status: 'loading' })
    runHealthCheck()
  }, [runHealthCheck])

  useEffect(() => {
    const controller = new AbortController()
    runHealthCheck(controller.signal)
    return () => controller.abort()
  }, [runHealthCheck])

  return (
    <section className={styles.container}>
      <p className={styles.eyebrow}>Yakuza Studio Project Management</p>
      <h1 className={styles.title}>YKanban</h1>
      <p className={styles.lead}>
        Fundação do frontend está no ar. As próximas etapas vão trazer autenticação, projetos e o
        board Kanban.
      </p>

      <div className={styles.statusArea}>
        {connectivity.status === 'loading' && (
          <StatusMessage variant="loading" title="Verificando conexão com o backend…" />
        )}

        {connectivity.status === 'online' && (
          <div className={styles.online} role="status">
            <CheckCircle2 className={styles.onlineIcon} size={28} aria-hidden="true" />
            <div>
              <p className={styles.onlineTitle}>Backend conectado</p>
              <p className={styles.onlineDetail}>
                Status reportado: <code className={styles.code}>{connectivity.backendStatus}</code>
              </p>
            </div>
          </div>
        )}

        {connectivity.status === 'offline' && (
          <StatusMessage
            variant="error"
            title="Backend indisponível"
            description={connectivity.message}
            action={
              <button type="button" className={styles.retry} onClick={retry}>
                Tentar novamente
              </button>
            }
          />
        )}
      </div>
    </section>
  )
}

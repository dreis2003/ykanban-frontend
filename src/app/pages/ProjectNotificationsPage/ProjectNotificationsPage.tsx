import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { integrationsApi } from '@/features/integrations/api/integrationsApi'
import type {
  CommunicationChannel,
  NotificationEvent,
  ProjectNotificationDestination,
} from '@/features/integrations/types'
import { projectsApi } from '@/features/projects/api/projectsApi'
import { ProjectPageHeader } from '@/features/projects/components/ProjectPageHeader/ProjectPageHeader'
import { StatusBadge } from '@/shared/components/StatusBadge/StatusBadge'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './ProjectNotificationsPage.module.css'

const EVENT_LABELS: Record<NotificationEvent, string> = {
  CARD_CREATED: 'Criação de Card',
  CARD_MOVED: 'Movimentação de Coluna',
  CARD_COMPLETED: 'Conclusão em Produção',
}

export function ProjectNotificationsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [channel, setChannel] = useState<CommunicationChannel>('EMAIL')
  const [recipient, setRecipient] = useState('')
  const [events, setEvents] = useState<NotificationEvent[]>(['CARD_CREATED', 'CARD_MOVED', 'CARD_COMPLETED'])
  const [active, setActive] = useState(true)

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsApi.get(projectId as string),
    enabled: Boolean(projectId),
  })

  const { data: destinations, isLoading: destinationsLoading } = useQuery({
    queryKey: ['project-notification-destinations', projectId],
    queryFn: () => integrationsApi.listDestinations(projectId as string),
    enabled: Boolean(projectId),
  })

  const createMutation = useMutation({
    mutationFn: (payload: { channel: CommunicationChannel; recipientPayload: string; events: NotificationEvent[]; active: boolean }) =>
      integrationsApi.createDestination(projectId as string, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-notification-destinations', projectId] })
      setIsModalOpen(false)
      setRecipient('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (destinationId: string) =>
      integrationsApi.deleteDestination(projectId as string, destinationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-notification-destinations', projectId] })
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    let payload = recipient
    if (channel === 'EMAIL') {
      payload = JSON.stringify({ email: recipient.trim() })
    } else if (channel === 'TELEGRAM') {
      payload = JSON.stringify({ chatId: recipient.trim() })
    } else if (channel === 'WHATSAPP') {
      payload = JSON.stringify({ phone: recipient.trim() })
    } else if (channel === 'WEBHOOK') {
      payload = JSON.stringify({ url: recipient.trim() })
    }

    createMutation.mutate({
      channel,
      recipientPayload: payload,
      events,
      active,
    })
  }

  const toggleEvent = (event: NotificationEvent) => {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    )
  }

  const parseRecipientDisplay = (dest: ProjectNotificationDestination) => {
    try {
      const parsed = JSON.parse(dest.recipientPayload)
      return parsed.email || parsed.chatId || parsed.phone || parsed.url || dest.recipientPayload
    } catch {
      return dest.recipientPayload
    }
  }

  if (projectLoading || destinationsLoading) {
    return <StatusMessage variant="loading" title="Carregando notificações do projeto..." />
  }

  if (!project) {
    return <StatusMessage variant="error" title="Projeto não encontrado." />
  }

  return (
    <section className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Navegação">
        <Link to={ROUTES.projects}>Projetos</Link>
        <span aria-hidden="true">/</span>
        <span className={styles.breadcrumbCurrent}>{project.name}</span>
      </nav>

      <ProjectPageHeader project={project} active="notifications" />

      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Destinos de Notificação do Projeto</h2>
          <p className={styles.breadcrumbCurrent}>
            Eventos disparados neste projeto serão enfileirados no Outbox e roteados pelo YCommunication.
          </p>
        </div>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() => setIsModalOpen(true)}
        >
          Adicionar Destino
        </button>
      </div>

      {destinations && destinations.length > 0 ? (
        <div className={styles.destinationsList} data-testid="destinations-list">
          {destinations.map((dest) => (
            <div key={dest.id} className={styles.destinationCard}>
              <div className={styles.destinationInfo}>
                <div className={styles.destinationHeader}>
                  <span className={styles.channelBadge} data-channel={dest.channel}>
                    {dest.channel}
                  </span>
                  <span className={styles.recipientText}>{parseRecipientDisplay(dest)}</span>
                  <StatusBadge status={dest.active ? 'ACTIVE' : 'ARCHIVED'} />
                </div>
                <div className={styles.eventsList}>
                  {dest.events.map((evt) => (
                    <span key={evt} className={styles.eventBadge}>
                      {EVENT_LABELS[evt] ?? evt}
                    </span>
                  ))}
                </div>
              </div>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.btnDanger}
                  onClick={() => deleteMutation.mutate(dest.id)}
                  disabled={deleteMutation.isPending}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          Nenhum destino de notificação configurado para este projeto. Clique em "Adicionar Destino" para começar.
        </div>
      )}

      {isModalOpen ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Novo Destino de Notificação</h3>
            <form className={styles.modalForm} onSubmit={handleCreate}>
              <div className={styles.field}>
                <label htmlFor="channel-select" className={styles.label}>Canal de Comunicação</label>
                <select
                  id="channel-select"
                  className={styles.select}
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as CommunicationChannel)}
                >
                  <option value="EMAIL">E-mail (SMTP)</option>
                  <option value="TELEGRAM">Telegram Bot</option>
                  <option value="WHATSAPP">WhatsApp Cloud API</option>
                  <option value="WEBHOOK">Generic Webhook</option>
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="recipient-input" className={styles.label}>
                  {channel === 'EMAIL' && 'Endereço de E-mail'}
                  {channel === 'TELEGRAM' && 'Telegram Chat ID (ex: -1001234567890)'}
                  {channel === 'WHATSAPP' && 'Número de Telefone com DDI/DDD (ex: +5511999998888)'}
                  {channel === 'WEBHOOK' && 'URL do Webhook (ex: https://webhook.site/...)'}
                </label>
                <input
                  id="recipient-input"
                  type="text"
                  required
                  className={styles.input}
                  placeholder={
                    channel === 'EMAIL'
                      ? 'notificacoes@empresa.com.br'
                      : channel === 'TELEGRAM'
                      ? '-1001234567890'
                      : channel === 'WHATSAPP'
                      ? '+5511999998888'
                      : 'https://api.empresa.com.br/webhooks/ykanban'
                  }
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Eventos Disparadores</label>
                <div className={styles.checkboxGroup}>
                  {(['CARD_CREATED', 'CARD_MOVED', 'CARD_COMPLETED'] as NotificationEvent[]).map((evt) => (
                    <label key={evt} className={styles.checkboxItem}>
                      <input
                        type="checkbox"
                        checked={events.includes(evt)}
                        onChange={() => toggleEvent(evt)}
                      />
                      <span>{EVENT_LABELS[evt]}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className={styles.checkboxItem}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                <span>Destino ativo</span>
              </label>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.btnDanger}
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={createMutation.isPending || !recipient || events.length === 0}
                >
                  {createMutation.isPending ? 'Salvando...' : 'Salvar Destino'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}

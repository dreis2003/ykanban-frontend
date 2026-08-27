import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { useAuth } from '@/features/auth/AuthContext'
import { integrationsApi } from '@/features/integrations/api/integrationsApi'
import type {
  CommunicationChannel,
  NotificationEvent,
  ProjectNotificationDestination,
} from '@/features/integrations/types'
import { notificationsApi } from '@/features/notifications/api/notificationsApi'
import { NotificationDetailDrawer } from '@/features/notifications/components/NotificationDetailDrawer/NotificationDetailDrawer'
import { NotificationList } from '@/features/notifications/components/NotificationList/NotificationList'
import type { NotificationSummary } from '@/features/notifications/types'
import { projectsApi } from '@/features/projects/api/projectsApi'
import { ProjectPageHeader } from '@/features/projects/components/ProjectPageHeader/ProjectPageHeader'
import { StatusBadge } from '@/shared/components/StatusBadge/StatusBadge'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './ProjectNotificationsPage.module.css'

const CHANNEL_FILTER_OPTIONS: CommunicationChannel[] = ['EMAIL', 'TELEGRAM', 'WHATSAPP', 'WEBHOOK']
const DISPATCH_STATUS_FILTER_OPTIONS = ['PENDING', 'DISPATCHED', 'FAILED', 'DEAD_LETTER']
const REMOTE_STATUS_FILTER_OPTIONS = ['SENT', 'DELIVERED', 'READ', 'FAILED', 'DEAD_LETTER']

const EVENT_LABELS: Record<NotificationEvent, string> = {
  CARD_CREATED: 'Criação de Card',
  CARD_MOVED: 'Movimentação de Coluna',
  CARD_COMPLETED: 'Conclusão em Produção',
}

export function ProjectNotificationsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()
  const { activeTenant } = useAuth()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [channel, setChannel] = useState<CommunicationChannel>('EMAIL')
  const [recipient, setRecipient] = useState('')
  const [events, setEvents] = useState<NotificationEvent[]>(['CARD_CREATED', 'CARD_MOVED', 'CARD_COMPLETED'])
  const [active, setActive] = useState(true)

  const [historyPage, setHistoryPage] = useState(0)
  const [channelFilter, setChannelFilter] = useState('')
  const [dispatchStatusFilter, setDispatchStatusFilter] = useState('')
  const [remoteStatusFilter, setRemoteStatusFilter] = useState('')
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null)

  // Ao trocar de Tenant, nunca deixar lista/detail do Tenant anterior visíveis — ajuste de estado
  // durante o render (mesmo padrão de `lastUrlSearch` em ProjectsPage), não em useEffect.
  const [lastTenantId, setLastTenantId] = useState(activeTenant?.id)
  if (lastTenantId !== activeTenant?.id) {
    setLastTenantId(activeTenant?.id)
    setSelectedNotificationId(null)
    setHistoryPage(0)
  }

  const notificationsQuery = useQuery({
    queryKey: [
      'project-notifications',
      activeTenant?.id,
      projectId,
      { page: historyPage, channel: channelFilter, dispatchStatus: dispatchStatusFilter, remoteStatus: remoteStatusFilter },
    ],
    queryFn: () =>
      notificationsApi.list(projectId as string, {
        page: historyPage,
        ...(channelFilter ? { channel: channelFilter } : {}),
        ...(dispatchStatusFilter ? { dispatchStatus: dispatchStatusFilter } : {}),
        ...(remoteStatusFilter ? { remoteStatus: remoteStatusFilter } : {}),
      }),
    enabled: Boolean(projectId) && Boolean(activeTenant?.id),
  })

  const notificationDetailQuery = useQuery({
    queryKey: ['project-notification-detail', activeTenant?.id, projectId, selectedNotificationId],
    queryFn: () => notificationsApi.getDetail(projectId as string, selectedNotificationId as string),
    enabled: Boolean(projectId) && Boolean(activeTenant?.id) && Boolean(selectedNotificationId),
  })

  function handleFilterChange(patch: Partial<{ channel: string; dispatchStatus: string; remoteStatus: string }>) {
    if (patch.channel !== undefined) setChannelFilter(patch.channel)
    if (patch.dispatchStatus !== undefined) setDispatchStatusFilter(patch.dispatchStatus)
    if (patch.remoteStatus !== undefined) setRemoteStatusFilter(patch.remoteStatus)
    setHistoryPage(0)
  }

  function handleSelectNotification(notification: NotificationSummary) {
    setSelectedNotificationId(notification.id)
  }

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

      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Notificações Enviadas</h2>
          <p className={styles.breadcrumbCurrent}>
            Envio ao Hub reflete se o YCommunication aceitou a mensagem; status remoto vem exclusivamente dos
            Delivery Receipts recebidos — os dois podem divergir.
          </p>
        </div>
      </div>

      <div className={styles.filterBar} data-testid="notifications-filter-bar">
        <select
          aria-label="Filtrar por canal"
          value={channelFilter}
          onChange={(e) => handleFilterChange({ channel: e.target.value })}
        >
          <option value="">Todos os canais</option>
          {CHANNEL_FILTER_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por envio ao Hub"
          value={dispatchStatusFilter}
          onChange={(e) => handleFilterChange({ dispatchStatus: e.target.value })}
        >
          <option value="">Qualquer envio ao Hub</option>
          {DISPATCH_STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por status remoto"
          value={remoteStatusFilter}
          onChange={(e) => handleFilterChange({ remoteStatus: e.target.value })}
        >
          <option value="">Qualquer status remoto</option>
          {REMOTE_STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      {notificationsQuery.isLoading ? (
        <StatusMessage variant="loading" title="Carregando notificações enviadas..." />
      ) : null}

      {notificationsQuery.isError ? (
        <StatusMessage variant="error" title="Falha ao carregar notificações enviadas." />
      ) : null}

      {!notificationsQuery.isLoading && !notificationsQuery.isError && notificationsQuery.data ? (
        notificationsQuery.data.content.length > 0 ? (
          <NotificationList
            notifications={notificationsQuery.data.content}
            page={notificationsQuery.data.page}
            totalPages={notificationsQuery.data.totalPages}
            onPageChange={setHistoryPage}
            onSelect={handleSelectNotification}
          />
        ) : (
          <StatusMessage variant="empty" title="Nenhuma notificação enviada para este projeto." />
        )
      ) : null}

      {selectedNotificationId ? (
        <NotificationDetailDrawer
          detail={notificationDetailQuery.data}
          isLoading={notificationDetailQuery.isLoading}
          isError={notificationDetailQuery.isError}
          onClose={() => setSelectedNotificationId(null)}
        />
      ) : null}

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

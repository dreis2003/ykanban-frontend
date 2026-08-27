import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { integrationsApi } from '@/features/integrations/api/integrationsApi'
import type { CommunicationChannel, NotificationEvent } from '@/features/integrations/types'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './NotificationTemplateConfig.module.css'

const EVENT_OPTIONS: NotificationEvent[] = ['CARD_CREATED', 'CARD_MOVED', 'CARD_COMPLETED']
const EVENT_LABELS: Record<NotificationEvent, string> = {
  CARD_CREATED: 'Criação de Card',
  CARD_MOVED: 'Movimentação de Coluna',
  CARD_COMPLETED: 'Conclusão em Produção',
}

const VARIABLE_TYPE_LABELS: Record<string, string> = {
  STRING: 'Texto',
  NUMBER: 'Número',
  BOOLEAN: 'Booleano',
}

interface Props {
  projectId: string
}

export function NotificationTemplateConfig({ projectId }: Props) {
  const { activeTenant } = useAuth()
  const queryClient = useQueryClient()

  const [selectedEvent, setSelectedEvent] = useState<NotificationEvent>('CARD_CREATED')
  const [selectedChannel, setSelectedChannel] = useState<CommunicationChannel | ''>('')
  const [selectedTemplateCode, setSelectedTemplateCode] = useState('')

  const catalogQuery = useQuery({
    queryKey: ['project-notification-template-catalog', activeTenant?.id],
    queryFn: () => integrationsApi.listTemplateCatalog(),
    enabled: Boolean(activeTenant?.id),
  })

  const mappingsQuery = useQuery({
    queryKey: ['project-notification-event-templates', activeTenant?.id, projectId],
    queryFn: () => integrationsApi.listProjectEventTemplates(projectId),
    enabled: Boolean(activeTenant?.id) && Boolean(projectId),
  })

  const saveMutation = useMutation({
    mutationFn: () =>
      integrationsApi.saveProjectEventTemplate(projectId, {
        eventType: selectedEvent,
        channel: selectedChannel as CommunicationChannel,
        templateCode: selectedTemplateCode,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['project-notification-event-templates', activeTenant?.id, projectId],
      })
      setSelectedChannel('')
      setSelectedTemplateCode('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (mapping: { eventType: string; channel: string }) =>
      integrationsApi.deleteProjectEventTemplate(projectId, mapping.eventType, mapping.channel),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['project-notification-event-templates', activeTenant?.id, projectId],
      })
    },
  })

  const catalog = catalogQuery.data ?? []
  const availableChannels = Array.from(new Set(catalog.map((item) => item.channel)))
  const templatesForChannel = selectedChannel ? catalog.filter((item) => item.channel === selectedChannel) : []
  const selectedTemplate = templatesForChannel.find((item) => item.code === selectedTemplateCode)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedChannel || !selectedTemplateCode) return
    saveMutation.mutate()
  }

  return (
    <div className={styles.container}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Templates de Notificação</h2>
          <p className={styles.description}>
            Cada evento + canal usa um template administrado no YCommunication. O YKanban só envia os dados do
            evento — quem monta o texto final é o YCommunication.
          </p>
        </div>
      </div>

      {catalogQuery.isLoading ? <StatusMessage variant="loading" title="Carregando catálogo de templates..." /> : null}

      {catalogQuery.isError ? (
        <StatusMessage variant="error" title="Falha ao carregar o catálogo de templates." />
      ) : null}

      {!catalogQuery.isLoading && !catalogQuery.isError && catalog.length === 0 ? (
        <StatusMessage
          variant="empty"
          title="Nenhum template disponível."
          description="Configure a integração YCommunication e vincule templates às Applications primeiro."
        />
      ) : null}

      {!catalogQuery.isLoading && !catalogQuery.isError && catalog.length > 0 ? (
        <>
          <form className={styles.form} onSubmit={handleSubmit} data-testid="template-config-form">
            <div className={styles.field}>
              <label htmlFor="template-event-select" className={styles.label}>
                Evento
              </label>
              <select
                id="template-event-select"
                className={styles.select}
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value as NotificationEvent)}
              >
                {EVENT_OPTIONS.map((evt) => (
                  <option key={evt} value={evt}>
                    {EVENT_LABELS[evt]}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="template-channel-select" className={styles.label}>
                Canal
              </label>
              <select
                id="template-channel-select"
                className={styles.select}
                value={selectedChannel}
                onChange={(e) => {
                  setSelectedChannel(e.target.value as CommunicationChannel)
                  setSelectedTemplateCode('')
                }}
              >
                <option value="">Selecione um canal</option>
                {availableChannels.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="template-code-select" className={styles.label}>
                Template
              </label>
              <select
                id="template-code-select"
                className={styles.select}
                value={selectedTemplateCode}
                onChange={(e) => setSelectedTemplateCode(e.target.value)}
                disabled={!selectedChannel}
              >
                <option value="">Selecione um template</option>
                {templatesForChannel.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.code} — {item.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={!selectedChannel || !selectedTemplateCode || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </form>

          {selectedTemplate ? (
            <div className={styles.variableContract} data-testid="template-variable-contract">
              <p className={styles.variableContractTitle}>Contrato de Variáveis (somente leitura)</p>
              <ul className={styles.variableList}>
                {selectedTemplate.variables.map((variable) => (
                  <li key={variable.path} className={styles.variableItem}>
                    <code>{variable.path}</code>
                    <span> · {VARIABLE_TYPE_LABELS[variable.type] ?? variable.type}</span>
                    <span> · {variable.required ? 'obrigatório' : 'opcional'}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      {mappingsQuery.isLoading ? <StatusMessage variant="loading" title="Carregando configuração..." /> : null}

      {mappingsQuery.isError ? (
        <StatusMessage variant="error" title="Falha ao carregar a configuração de templates deste projeto." />
      ) : null}

      {!mappingsQuery.isLoading && !mappingsQuery.isError && mappingsQuery.data && mappingsQuery.data.length > 0 ? (
        <table className={styles.table} data-testid="template-mappings-table">
          <thead>
            <tr>
              <th>Evento</th>
              <th>Canal</th>
              <th>Template</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {mappingsQuery.data.map((mapping) => (
              <tr key={mapping.id}>
                <td>{EVENT_LABELS[mapping.eventType] ?? mapping.eventType}</td>
                <td>
                  <span className={styles.channelBadge} data-channel={mapping.channel}>
                    {mapping.channel}
                  </span>
                </td>
                <td>{mapping.templateCode}</td>
                <td>
                  <button
                    type="button"
                    className={styles.btnDanger}
                    onClick={() => deleteMutation.mutate({ eventType: mapping.eventType, channel: mapping.channel })}
                    disabled={deleteMutation.isPending}
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {!mappingsQuery.isLoading && !mappingsQuery.isError && mappingsQuery.data && mappingsQuery.data.length === 0 ? (
        <p className={styles.emptyMappings}>Nenhum evento configurado com template ainda.</p>
      ) : null}
    </div>
  )
}

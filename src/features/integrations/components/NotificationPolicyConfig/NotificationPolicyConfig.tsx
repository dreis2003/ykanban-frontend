import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { integrationsApi } from '@/features/integrations/api/integrationsApi'
import type { NotificationEvent } from '@/features/integrations/types'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './NotificationPolicyConfig.module.css'

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

const MODE_LABELS: Record<string, string> = {
  FAN_OUT: 'FAN_OUT',
  FALLBACK: 'FALLBACK',
}

const MODE_HELP: Record<string, string> = {
  FAN_OUT: 'Envia por todos os canais configurados.',
  FALLBACK: 'Tenta as rotas em ordem até uma delas ser enviada com sucesso.',
}

interface Props {
  projectId: string
}

/** Configuração, por evento, de qual Notification Policy usar (YCOM-018) — modo POLICY, preferido
 * sobre o modo TEMPLATE legado (`NotificationTemplateConfig`) quando ambos estão configurados para
 * o mesmo evento; o backend sempre prioriza a Policy nesse caso. O YKanban nunca conhece canal
 * físico, template concreto ou destino nesse modo — só a intenção (`policyCode`). */
export function NotificationPolicyConfig({ projectId }: Props) {
  const { activeTenant } = useAuth()
  const queryClient = useQueryClient()

  const [selectedEvent, setSelectedEvent] = useState<NotificationEvent>('CARD_CREATED')
  const [selectedPolicyCode, setSelectedPolicyCode] = useState('')

  const catalogQuery = useQuery({
    queryKey: ['project-notification-policy-catalog', activeTenant?.id],
    queryFn: () => integrationsApi.listNotificationPolicyCatalog(),
    enabled: Boolean(activeTenant?.id),
  })

  const policyMappingsQuery = useQuery({
    queryKey: ['project-notification-event-policies', activeTenant?.id, projectId],
    queryFn: () => integrationsApi.listProjectEventPolicies(projectId),
    enabled: Boolean(activeTenant?.id) && Boolean(projectId),
  })

  // Mesma chave já usada por NotificationTemplateConfig — React Query deduplica, não gera uma
  // segunda chamada de rede, só reaproveita o cache para cruzar os dois catálogos.
  const templateMappingsQuery = useQuery({
    queryKey: ['project-notification-event-templates', activeTenant?.id, projectId],
    queryFn: () => integrationsApi.listProjectEventTemplates(projectId),
    enabled: Boolean(activeTenant?.id) && Boolean(projectId),
  })

  const saveMutation = useMutation({
    mutationFn: () => integrationsApi.saveProjectEventPolicy(projectId, { eventType: selectedEvent, policyCode: selectedPolicyCode }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-notification-event-policies', activeTenant?.id, projectId] })
      setSelectedPolicyCode('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (eventType: string) => integrationsApi.deleteProjectEventPolicy(projectId, eventType),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-notification-event-policies', activeTenant?.id, projectId] })
    },
  })

  const catalog = catalogQuery.data ?? []
  const selectedPolicy = catalog.find((item) => item.code === selectedPolicyCode)
  const eventHasTemplateMapping = (templateMappingsQuery.data ?? []).some((m) => m.eventType === selectedEvent)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPolicyCode) return
    saveMutation.mutate()
  }

  return (
    <div className={styles.container}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Notification Policies</h2>
          <p className={styles.description}>
            Cada evento pode usar uma Policy administrada no YCommunication — ela decide canal(is), template(s),
            destino e ordem de envio. O YKanban só envia os dados do evento, nunca o canal físico.
          </p>
        </div>
      </div>

      {catalogQuery.isLoading ? <StatusMessage variant="loading" title="Carregando catálogo de policies..." /> : null}

      {catalogQuery.isError ? <StatusMessage variant="error" title="Falha ao carregar o catálogo de policies." /> : null}

      {!catalogQuery.isLoading && !catalogQuery.isError && catalog.length === 0 ? (
        <StatusMessage
          variant="empty"
          title="Nenhuma Notification Policy disponível."
          description="Configure Policies no YCommunication e vincule-as à Application primeiro."
        />
      ) : null}

      {!catalogQuery.isLoading && !catalogQuery.isError && catalog.length > 0 ? (
        <>
          <form className={styles.form} onSubmit={handleSubmit} data-testid="policy-config-form">
            <div className={styles.field}>
              <label htmlFor="policy-event-select" className={styles.label}>
                Evento
              </label>
              <select
                id="policy-event-select"
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
              <label htmlFor="policy-code-select" className={styles.label}>
                Policy
              </label>
              <select
                id="policy-code-select"
                className={styles.select}
                value={selectedPolicyCode}
                onChange={(e) => setSelectedPolicyCode(e.target.value)}
              >
                <option value="">Selecione uma policy</option>
                {catalog.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.code} — {item.name}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className={styles.btnPrimary} disabled={!selectedPolicyCode || saveMutation.isPending}>
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </form>

          {eventHasTemplateMapping ? (
            <p className={styles.warning} data-testid="policy-template-conflict-warning">
              Este evento também tem um Template configurado — a Policy tem prioridade e será usada.
            </p>
          ) : null}

          {selectedPolicy ? (
            <div className={styles.variableContract} data-testid="policy-variable-contract">
              <p className={styles.variableContractTitle}>
                Modo: <span data-testid="policy-mode">{MODE_LABELS[selectedPolicy.mode] ?? selectedPolicy.mode}</span>
              </p>
              <p className={styles.modeHelp}>{MODE_HELP[selectedPolicy.mode] ?? ''}</p>
              <p className={styles.variableContractTitle}>Contrato de Variáveis (somente leitura)</p>
              <ul className={styles.variableList}>
                {selectedPolicy.variables.map((variable) => (
                  <li key={variable.name} className={styles.variableItem}>
                    <code>{variable.name}</code>
                    <span> · {VARIABLE_TYPE_LABELS[variable.type] ?? variable.type}</span>
                    <span> · {variable.required ? 'obrigatório' : 'opcional'}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      {policyMappingsQuery.isLoading ? <StatusMessage variant="loading" title="Carregando configuração..." /> : null}

      {policyMappingsQuery.isError ? (
        <StatusMessage variant="error" title="Falha ao carregar a configuração de policies deste projeto." />
      ) : null}

      {!policyMappingsQuery.isLoading && !policyMappingsQuery.isError && policyMappingsQuery.data && policyMappingsQuery.data.length > 0 ? (
        <table className={styles.table} data-testid="policy-mappings-table">
          <thead>
            <tr>
              <th>Evento</th>
              <th>Policy</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {policyMappingsQuery.data.map((mapping) => (
              <tr key={mapping.id}>
                <td>{EVENT_LABELS[mapping.eventType] ?? mapping.eventType}</td>
                <td>{mapping.policyCode}</td>
                <td>
                  <button
                    type="button"
                    className={styles.btnDanger}
                    onClick={() => deleteMutation.mutate(mapping.eventType)}
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

      {!policyMappingsQuery.isLoading && !policyMappingsQuery.isError && policyMappingsQuery.data && policyMappingsQuery.data.length === 0 ? (
        <p className={styles.emptyMappings}>Nenhum evento configurado com policy ainda.</p>
      ) : null}
    </div>
  )
}

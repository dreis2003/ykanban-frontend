import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { integrationsApi } from '@/features/integrations/api/integrationsApi'
import type { TestConnectionResponse } from '@/features/integrations/types'
import { StatusBadge } from '@/shared/components/StatusBadge/StatusBadge'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './TenantIntegrationsPage.module.css'

export function TenantIntegrationsPage() {
  const queryClient = useQueryClient()

  const [baseUrlDraft, setBaseUrlDraft] = useState<string | null>(null)
  const [activeDraft, setActiveDraft] = useState<boolean | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null)
  const [savedSuccess, setSavedSuccess] = useState(false)

  const { data: integration, isLoading, isError } = useQuery({
    queryKey: ['ycommunication-integration'],
    queryFn: integrationsApi.getIntegration,
  })

  const baseUrl = baseUrlDraft ?? integration?.baseUrl ?? ''
  const active = activeDraft ?? (integration?.configured ? integration.active : true)

  const saveMutation = useMutation({
    mutationFn: integrationsApi.saveIntegration,
    onSuccess: (data) => {
      queryClient.setQueryData(['ycommunication-integration'], data)
      setSavedSuccess(true)
      setApiKey('')
      setBaseUrlDraft(null)
      setActiveDraft(null)
      setTimeout(() => setSavedSuccess(false), 4000)
    },
  })

  const testMutation = useMutation({
    mutationFn: integrationsApi.testConnection,
    onSuccess: (data) => {
      setTestResult(data)
    },
  })

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setSavedSuccess(false)
    saveMutation.mutate({
      baseUrl,
      apiKey: apiKey.trim() || undefined,
      active,
    })
  }

  const handleTest = () => {
    setTestResult(null)
    testMutation.mutate({
      baseUrl: baseUrl.trim() || undefined,
      apiKey: apiKey.trim() || undefined,
    })
  }

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Integrações da Organização</h1>
        <p className={styles.description}>
          Configure a comunicação oficial com o YCommunication Hub para envio de notificações por E-mail, Telegram, WhatsApp e Webhook.
        </p>
      </div>

      {isLoading ? <StatusMessage variant="loading" title="Carregando integração..." /> : null}
      {isError ? <StatusMessage variant="error" title="Não foi possível carregar as configurações de integração." /> : null}

      {!isLoading && !isError ? (
        <div className={styles.card} data-testid="ycommunication-integration-card">
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>YCommunication Hub</h2>
              <p className={styles.helperText}>Client API oficial (v1) e SDK Java da Yakuza Sistemas</p>
            </div>
            <StatusBadge
              status={integration?.configured && integration.active ? 'ACTIVE' : 'ARCHIVED'}
            />
          </div>

          <form className={styles.form} onSubmit={handleSave}>
            <div className={styles.field}>
              <label htmlFor="base-url" className={styles.label}>
                Base URL do YCommunication
              </label>
              <input
                id="base-url"
                type="url"
                required
                className={styles.input}
                placeholder="http://localhost:8080 ou https://communication.empresa.com.br"
                value={baseUrl}
                onChange={(e) => setBaseUrlDraft(e.target.value)}
              />
              <span className={styles.helperText}>
                Endereço base do servidor YCommunication. O SDK adicionará automaticamente as rotas de Client API.
              </span>
            </div>

            <div className={styles.field}>
              <label htmlFor="api-key" className={styles.label}>
                API Key (Write-Only)
              </label>
              <input
                id="api-key"
                type="password"
                className={styles.input}
                placeholder={integration?.configured ? 'ycom_*** (Preencha somente para alterar)' : 'ycom_live_...'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <span className={styles.helperText}>
                Credencial emitida no YCommunication para esta aplicação (escopos <code>MESSAGES_SEND</code>, <code>MESSAGES_READ</code>). Criptografada em repouso via AES-256-GCM.
              </span>
            </div>

            <label className={styles.checkboxContainer}>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActiveDraft(e.target.checked)}
              />
              <span>Ativar integração de notificações para todos os projetos da organização</span>
            </label>

            {testResult?.success ? (
              <div className={styles.testResultSuccess} data-testid="test-connection-success">
                <strong>Conexão bem-sucedida!</strong>
                <div>Aplicação: {testResult.applicationName}</div>
                <div>Empresa: {testResult.companyName}</div>
                <div>Escopos: {testResult.scopes.join(', ')}</div>
              </div>
            ) : null}

            {testResult && !testResult.success ? (
              <div className={styles.testResultError} data-testid="test-connection-error">
                <strong>Falha na conexão:</strong> {testResult.errorMessage}
              </div>
            ) : null}

            {savedSuccess ? (
              <div className={styles.testResultSuccess} data-testid="save-success-banner">
                Configurações da integração salvas com sucesso!
              </div>
            ) : null}

            <div className={styles.actions}>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={saveMutation.isPending || !baseUrl}
              >
                {saveMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
              </button>

              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleTest}
                disabled={testMutation.isPending || (!baseUrl && !integration?.configured)}
              >
                {testMutation.isPending ? 'Testando...' : 'Testar Conexão'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  )
}

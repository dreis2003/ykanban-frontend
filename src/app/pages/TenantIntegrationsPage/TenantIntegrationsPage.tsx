import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { integrationsApi } from '@/features/integrations/api/integrationsApi'
import type { DeliveryReceiptStatus, TestConnectionResponse } from '@/features/integrations/types'
import { StatusBadge } from '@/shared/components/StatusBadge/StatusBadge'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './TenantIntegrationsPage.module.css'

const DELIVERY_RECEIPT_STATUSES: DeliveryReceiptStatus[] = [
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED',
  'DEAD_LETTER',
]

const MIN_SIGNING_SECRET_LENGTH = 16

export function TenantIntegrationsPage() {
  const queryClient = useQueryClient()

  const [activeDraft, setActiveDraft] = useState<boolean | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [signingSecret, setSigningSecret] = useState('')
  const [secretSavedSuccess, setSecretSavedSuccess] = useState(false)
  const [callbackUrlCopied, setCallbackUrlCopied] = useState(false)

  const { data: integration, isLoading, isError } = useQuery({
    queryKey: ['ycommunication-integration'],
    queryFn: integrationsApi.getIntegration,
  })

  const active = activeDraft ?? (integration?.configured ? integration.active : true)
  const apiKeyConfigured = integration?.configured === true

  const {
    data: deliveryReceiptConfig,
    isLoading: isLoadingDeliveryReceipts,
    isError: isDeliveryReceiptsError,
  } = useQuery({
    queryKey: ['ycommunication-delivery-receipts'],
    queryFn: integrationsApi.getDeliveryReceiptConfig,
    enabled: apiKeyConfigured,
  })

  const setSigningSecretMutation = useMutation({
    mutationFn: integrationsApi.setDeliveryReceiptSigningSecret,
    onSuccess: (data) => {
      queryClient.setQueryData(['ycommunication-delivery-receipts'], data)
      setSecretSavedSuccess(true)
      setSigningSecret('')
      setTimeout(() => setSecretSavedSuccess(false), 4000)
    },
  })

  const saveMutation = useMutation({
    mutationFn: integrationsApi.saveIntegration,
    onSuccess: (data) => {
      queryClient.setQueryData(['ycommunication-integration'], data)
      setSavedSuccess(true)
      setApiKey('')
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
      apiKey: apiKey.trim() || undefined,
      active,
    })
  }

  const handleTest = () => {
    setTestResult(null)
    testMutation.mutate({
      apiKey: apiKey.trim() || undefined,
    })
  }

  const handleSetSigningSecret = (e: React.FormEvent) => {
    e.preventDefault()
    setSecretSavedSuccess(false)
    setSigningSecretMutation.mutate({ signingSecret: signingSecret.trim() })
  }

  const handleCopyCallbackUrl = async () => {
    if (!deliveryReceiptConfig?.callbackUrl) {
      return
    }
    try {
      await navigator.clipboard.writeText(deliveryReceiptConfig.callbackUrl)
      setCallbackUrlCopied(true)
      setTimeout(() => setCallbackUrlCopied(false), 2000)
    } catch {
      // Clipboard indisponível (ex.: contexto não seguro) — o valor já está visível no campo somente leitura.
    }
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
              <label htmlFor="base-url-readonly" className={styles.label}>
                Servidor YCommunication Conectado (Configuração Confiável do Ambiente)
              </label>
              <input
                id="base-url-readonly"
                type="text"
                readOnly
                disabled
                className={styles.input}
                value={integration?.baseUrl || 'http://localhost:8080'}
              />
              <span className={styles.helperText}>
                O host de destino é gerenciado exclusivamente pela infraestrutura do sistema (Anti-SSRF).
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
                disabled={saveMutation.isPending || (!apiKey && !integration?.configured)}
              >
                {saveMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
              </button>

              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleTest}
                disabled={testMutation.isPending || (!apiKey && !integration?.configured)}
              >
                {testMutation.isPending ? 'Testando...' : 'Testar Conexão'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {!isLoading && !isError && apiKeyConfigured ? (
        <div className={styles.card} data-testid="delivery-receipts-card">
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Delivery Receipts</h2>
              <p className={styles.helperText}>
                Notificações assinadas de status real de entrega das mensagens (SENT, DELIVERED, READ, FAILED, DEAD_LETTER)
              </p>
            </div>
          </div>

          {isLoadingDeliveryReceipts ? (
            <StatusMessage variant="loading" title="Carregando configuração de delivery receipts..." />
          ) : null}
          {isDeliveryReceiptsError ? (
            <StatusMessage
              variant="error"
              title="Não foi possível carregar a configuração de delivery receipts."
            />
          ) : null}

          {!isLoadingDeliveryReceipts && !isDeliveryReceiptsError ? (
            <form className={styles.form} onSubmit={handleSetSigningSecret}>
              <div className={styles.field}>
                <label htmlFor="delivery-receipt-callback-url" className={styles.label}>
                  Callback URL
                </label>
                <div className={styles.inputRow}>
                  <input
                    id="delivery-receipt-callback-url"
                    type="text"
                    readOnly
                    disabled
                    className={styles.input}
                    value={deliveryReceiptConfig?.callbackUrl ?? ''}
                  />
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={handleCopyCallbackUrl}
                    disabled={!deliveryReceiptConfig?.callbackUrl}
                  >
                    {callbackUrlCopied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <span className={styles.helperText}>
                  Configure esta URL como destino da subscription de delivery receipts do aplicativo no YCommunication.
                </span>
              </div>

              <div className={styles.field}>
                <span className={styles.label}>Statuses suportados</span>
                <div className={styles.statusList}>
                  {DELIVERY_RECEIPT_STATUSES.map((status) => (
                    <span key={status} className={styles.statusChip}>
                      {status}
                    </span>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <span className={styles.label}>Signing Secret</span>
                {deliveryReceiptConfig?.signingSecretConfigured ? (
                  <span className={styles.secretConfigured} data-testid="signing-secret-status">
                    ✓ Configurado
                    {deliveryReceiptConfig.secretRotatedAt
                      ? ` (atualizado em ${new Date(deliveryReceiptConfig.secretRotatedAt).toLocaleString('pt-BR')})`
                      : ''}
                  </span>
                ) : (
                  <span className={styles.secretNotConfigured} data-testid="signing-secret-status">
                    Ainda não configurado
                  </span>
                )}
              </div>

              <div className={styles.field}>
                <label htmlFor="delivery-receipt-secret" className={styles.label}>
                  Colar Signing Secret
                </label>
                <input
                  id="delivery-receipt-secret"
                  type="password"
                  className={styles.input}
                  placeholder="Gerado pelo YCommunication ao criar/rotacionar a subscription"
                  value={signingSecret}
                  onChange={(e) => setSigningSecret(e.target.value)}
                />
                <span className={styles.helperText}>
                  Gere este valor na subscription de delivery receipts do YCommunication e cole aqui — os dois
                  lados precisam do mesmo segredo para a assinatura HMAC funcionar. Criptografado em repouso
                  via AES-256-GCM; nunca reexibido depois de salvo.
                </span>
              </div>

              {setSigningSecretMutation.isError ? (
                <div className={styles.testResultError} data-testid="signing-secret-save-error">
                  Não foi possível salvar o signing secret. Verifique se a API Key já está configurada e se o
                  valor colado está correto.
                </div>
              ) : null}

              {secretSavedSuccess ? (
                <div className={styles.testResultSuccess} data-testid="signing-secret-save-success-banner">
                  Signing secret salvo com sucesso!
                </div>
              ) : null}

              <div className={styles.actions}>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={
                    setSigningSecretMutation.isPending || signingSecret.trim().length < MIN_SIGNING_SECRET_LENGTH
                  }
                >
                  {setSigningSecretMutation.isPending ? 'Salvando...' : 'Salvar Signing Secret'}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      {!isLoading && !isError && !apiKeyConfigured ? (
        <div className={styles.card} data-testid="delivery-receipts-card">
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Delivery Receipts</h2>
            </div>
          </div>
          <StatusMessage
            variant="empty"
            title="Configure a API Key do YCommunication acima primeiro"
            description="A Callback URL e o signing secret de delivery receipts ficam disponíveis depois que a integração YCommunication estiver ativa."
          />
        </div>
      ) : null}
    </section>
  )
}

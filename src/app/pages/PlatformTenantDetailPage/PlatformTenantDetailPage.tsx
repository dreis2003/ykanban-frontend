import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { platformApi } from '@/features/platform/api/platformApi'
import { ReplaceInitialAdminDialog } from '@/features/platform/components/ReplaceInitialAdminDialog/ReplaceInitialAdminDialog'
import type { InitialAdminInvitationStatus, PlatformTenantDetail } from '@/features/platform/types'
import { SubscriptionSection } from '@/features/subscriptions/components/SubscriptionSection/SubscriptionSection'
import { ApiError } from '@/shared/api/apiError'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/ConfirmDialog'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './PlatformTenantDetailPage.module.css'

interface ProvisioningNavigationState {
  justProvisioned?: boolean
  adminEmail?: string
  emailSent?: boolean
}

const INITIAL_ADMIN_STATUS_LABELS: Record<InitialAdminInvitationStatus, string> = {
  PENDING: 'Convite pendente',
  EXPIRED: 'Convite expirado',
  REVOKED: 'Convite revogado',
  ACCEPTED: 'Convite aceito',
}

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

/** Detalhe de uma organização pela plataforma (ver ADR 0023/0024) — nunca lê conteúdo interno do
 * Tenant (Cards/Comments), só metadados (contagens + lista de ADMINs ativos + estado do convite de
 * ADMIN inicial). Nome é o único campo editável; slug é imutável após a criação. */
export function PlatformTenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>()
  const queryClient = useQueryClient()
  const location = useLocation()
  const provisioningState = location.state as ProvisioningNavigationState | null

  const [isEditingName, setIsEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [confirmingStatusChange, setConfirmingStatusChange] = useState(false)
  const [confirmingRevoke, setConfirmingRevoke] = useState(false)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [replaceError, setReplaceError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [provisioningBannerDismissed, setProvisioningBannerDismissed] = useState(false)

  const {
    data: tenant,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['platform', 'tenants', tenantId],
    queryFn: () => platformApi.getTenant(tenantId as string),
    enabled: Boolean(tenantId),
  })

  /** Aplica a resposta da mutation diretamente no cache do detalhe (em vez de só invalidar e
   * esperar um refetch) — evita um flash de dado desatualizado entre a mutação e o próximo GET. A
   * lista/dashboard continuam apenas invalidados, já que a resposta não cobre esse formato. */
  const applyDetail = (updated: PlatformTenantDetail) => {
    queryClient.setQueryData(['platform', 'tenants', tenantId], updated)
    queryClient.invalidateQueries({ queryKey: ['platform', 'tenants', 'list'] })
    queryClient.invalidateQueries({ queryKey: ['platform', 'dashboard'] })
  }

  const renameMutation = useMutation({
    mutationFn: (name: string) => platformApi.renameTenant(tenantId as string, name),
    onSuccess: (updated) => {
      applyDetail(updated)
      setIsEditingName(false)
      setRenameError(null)
    },
    onError: (error: unknown) => setRenameError(errorMessageFrom(error)),
  })

  const suspendMutation = useMutation({
    mutationFn: () => platformApi.suspendTenant(tenantId as string),
    onSuccess: (updated) => {
      applyDetail(updated)
      setConfirmingStatusChange(false)
      setActionError(null)
    },
    onError: (error: unknown) => {
      setActionError(errorMessageFrom(error))
      setConfirmingStatusChange(false)
    },
  })

  const activateMutation = useMutation({
    mutationFn: () => platformApi.activateTenant(tenantId as string),
    onSuccess: (updated) => {
      applyDetail(updated)
      setActionError(null)
    },
    onError: (error: unknown) => setActionError(errorMessageFrom(error)),
  })

  const resendInitialAdminMutation = useMutation({
    mutationFn: () => platformApi.resendInitialAdminInvitation(tenantId as string),
    onSuccess: (updated) => {
      applyDetail(updated)
      setActionError(null)
    },
    onError: (error: unknown) => setActionError(errorMessageFrom(error)),
  })

  const replaceInitialAdminMutation = useMutation({
    mutationFn: (email: string) => platformApi.replaceInitialAdminInvitation(tenantId as string, email),
    onSuccess: (updated) => {
      applyDetail(updated)
      setReplaceOpen(false)
      setReplaceError(null)
    },
    onError: (error: unknown) => setReplaceError(errorMessageFrom(error)),
  })

  const revokeInitialAdminMutation = useMutation({
    mutationFn: () => platformApi.revokeInitialAdminInvitation(tenantId as string),
    onSuccess: (updated) => {
      applyDetail(updated)
      setConfirmingRevoke(false)
      setActionError(null)
    },
    onError: (error: unknown) => {
      setActionError(errorMessageFrom(error))
      setConfirmingRevoke(false)
    },
  })

  function startEditingName() {
    setNameInput(tenant?.name ?? '')
    setRenameError(null)
    setIsEditingName(true)
  }

  function submitRename() {
    const trimmed = nameInput.trim()
    if (!trimmed) {
      setRenameError('Nome é obrigatório.')
      return
    }
    renameMutation.mutate(trimmed)
  }

  const showProvisioningBanner = provisioningState?.justProvisioned && !provisioningBannerDismissed

  return (
    <section className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Navegação">
        <Link to={ROUTES.platformTenants}>Empresas</Link>
        {tenant ? (
          <>
            <span aria-hidden="true">/</span>
            <span className={styles.breadcrumbCurrent}>{tenant.name}</span>
          </>
        ) : null}
      </nav>

      {showProvisioningBanner ? (
        <p className={provisioningState?.emailSent ? styles.successBanner : styles.warningBanner} role="status">
          {provisioningState?.emailSent
            ? `Empresa criada com sucesso. Convite enviado para ${provisioningState.adminEmail}.`
            : 'A empresa foi criada, mas não foi possível enviar o convite. Você pode reenviar o convite abaixo.'}
          <button type="button" className={styles.dismissBanner} onClick={() => setProvisioningBannerDismissed(true)}>
            Fechar
          </button>
        </p>
      ) : null}

      {isLoading ? <StatusMessage variant="loading" title="Carregando organização…" /> : null}
      {isError ? <StatusMessage variant="error" title="Não foi possível carregar esta organização." /> : null}

      {tenant ? (
        <>
          <header className={styles.header}>
            <div>
              {isEditingName ? (
                <div className={styles.renameForm}>
                  <input
                    type="text"
                    className={styles.renameInput}
                    value={nameInput}
                    onChange={(event) => setNameInput(event.target.value)}
                    disabled={renameMutation.isPending}
                    autoFocus
                  />
                  <button
                    type="button"
                    className={styles.saveButton}
                    onClick={submitRename}
                    disabled={renameMutation.isPending}
                  >
                    {renameMutation.isPending ? 'Salvando…' : 'Salvar'}
                  </button>
                  <button
                    type="button"
                    className={styles.cancelButton}
                    onClick={() => setIsEditingName(false)}
                    disabled={renameMutation.isPending}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <h1 className={styles.title}>
                  {tenant.name}
                  <button type="button" className={styles.editButton} onClick={startEditingName}>
                    Renomear
                  </button>
                </h1>
              )}
              {renameError ? (
                <p className={styles.fieldError} role="alert">
                  {renameError}
                </p>
              ) : null}
              <p className={styles.slug}>{tenant.slug}</p>
            </div>
            <span className={styles.statusBadge} data-status={tenant.status} data-testid="tenant-status-badge">
              {tenant.status === 'ACTIVE' ? 'Ativa' : 'Suspensa'}
            </span>
          </header>

          {actionError ? (
            <p className={styles.actionError} role="alert">
              {actionError}
            </p>
          ) : null}

          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <span className={styles.kpiTitle}>Membros vinculados</span>
              <span className={styles.kpiValue}>{tenant.memberCount}</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiTitle}>Projetos</span>
              <span className={styles.kpiValue}>{tenant.projectCount}</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiTitle}>Criada em</span>
              <span className={styles.kpiValue}>{new Date(tenant.createdAt).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          <SubscriptionSection tenantId={tenant.id} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Administrador inicial</h2>
            {tenant.admins.length > 0 ? (
              <ul className={styles.adminList}>
                {tenant.admins.map((admin) => (
                  <li key={admin.id} className={styles.adminItem}>
                    <span className={styles.adminName}>{admin.name}</span>
                    <span className={styles.adminEmail}>{admin.email}</span>
                    <span className={styles.onboardingBadge} data-onboarding="active">
                      Administrador ativo
                    </span>
                  </li>
                ))}
              </ul>
            ) : tenant.initialAdminInvitation ? (
              <div className={styles.invitationCard}>
                <div className={styles.invitationHeader}>
                  <span className={styles.invitationEmail}>{tenant.initialAdminInvitation.email}</span>
                  <span className={styles.onboardingBadge} data-onboarding={tenant.initialAdminInvitation.status}>
                    {INITIAL_ADMIN_STATUS_LABELS[tenant.initialAdminInvitation.status]}
                  </span>
                </div>
                <p className={styles.invitationMeta}>
                  Enviado em {new Date(tenant.initialAdminInvitation.createdAt).toLocaleString('pt-BR')} — expira em{' '}
                  {new Date(tenant.initialAdminInvitation.expiresAt).toLocaleString('pt-BR')}
                </p>
                <div className={styles.invitationActions}>
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={() => resendInitialAdminMutation.mutate()}
                    disabled={resendInitialAdminMutation.isPending || tenant.status === 'SUSPENDED'}
                  >
                    {resendInitialAdminMutation.isPending ? 'Reenviando…' : 'Reenviar'}
                  </button>
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={() => {
                      setReplaceError(null)
                      setReplaceOpen(true)
                    }}
                    disabled={tenant.status === 'SUSPENDED'}
                  >
                    Trocar e-mail
                  </button>
                  {tenant.initialAdminInvitation.status === 'PENDING' ? (
                    <button
                      type="button"
                      className={styles.actionButtonDanger}
                      onClick={() => setConfirmingRevoke(true)}
                      disabled={tenant.status === 'SUSPENDED'}
                    >
                      Revogar
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className={styles.emptyAdmins}>Nenhum convite de administrador registrado para esta organização.</p>
            )}
          </section>

          <div className={styles.actions}>
            {tenant.status === 'ACTIVE' ? (
              <button
                type="button"
                className={styles.dangerButton}
                onClick={() => setConfirmingStatusChange(true)}
              >
                Suspender organização
              </button>
            ) : (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => activateMutation.mutate()}
                disabled={activateMutation.isPending}
              >
                {activateMutation.isPending ? 'Reativando…' : 'Reativar organização'}
              </button>
            )}
          </div>

          <ConfirmDialog
            open={confirmingStatusChange}
            title={`Suspender ${tenant.name}?`}
            description="Usuários da organização perdem acesso de escrita e novos convites não podem ser aceitos até a reativação. Leitura e dados existentes são preservados."
            confirmLabel="Suspender"
            isConfirming={suspendMutation.isPending}
            onConfirm={() => suspendMutation.mutate()}
            onCancel={() => setConfirmingStatusChange(false)}
          />

          <ConfirmDialog
            open={confirmingRevoke}
            title="Revogar convite do administrador inicial?"
            description="A empresa continuará existindo, mas nenhum administrador poderá acessá-la até que um novo convite seja enviado."
            confirmLabel="Revogar"
            isConfirming={revokeInitialAdminMutation.isPending}
            onConfirm={() => revokeInitialAdminMutation.mutate()}
            onCancel={() => setConfirmingRevoke(false)}
          />

          <ReplaceInitialAdminDialog
            open={replaceOpen}
            isSubmitting={replaceInitialAdminMutation.isPending}
            errorMessage={replaceError}
            onSubmit={(email) => replaceInitialAdminMutation.mutate(email)}
            onClose={() => setReplaceOpen(false)}
          />
        </>
      ) : null}
    </section>
  )
}

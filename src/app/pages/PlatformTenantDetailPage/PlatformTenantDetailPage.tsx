import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { platformApi } from '@/features/platform/api/platformApi'
import type { PlatformTenantDetail } from '@/features/platform/types'
import { ApiError } from '@/shared/api/apiError'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/ConfirmDialog'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './PlatformTenantDetailPage.module.css'

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

/** Detalhe de uma organização pela plataforma (ver ADR 0023) — nunca lê conteúdo interno do
 * Tenant (Cards/Comments), só metadados (contagens + lista de ADMINs ativos). Nome é o único
 * campo editável; slug é imutável após a criação (ver Tenant#rename). */
export function PlatformTenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>()
  const queryClient = useQueryClient()

  const [isEditingName, setIsEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [confirmingStatusChange, setConfirmingStatusChange] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

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
            <span className={styles.statusBadge} data-status={tenant.status}>
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

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Administradores ativos</h2>
            {tenant.admins.length === 0 ? (
              <p className={styles.emptyAdmins}>Nenhum administrador ativo nesta organização.</p>
            ) : (
              <ul className={styles.adminList}>
                {tenant.admins.map((admin) => (
                  <li key={admin.id} className={styles.adminItem}>
                    <span className={styles.adminName}>{admin.name}</span>
                    <span className={styles.adminEmail}>{admin.email}</span>
                  </li>
                ))}
              </ul>
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
        </>
      ) : null}
    </section>
  )
}

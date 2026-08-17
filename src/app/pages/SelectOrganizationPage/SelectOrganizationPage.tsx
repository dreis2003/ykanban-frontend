import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { useAuth } from '@/features/auth/AuthContext'
import type { MembershipRole } from '@/features/auth/types'
import { ApiError } from '@/shared/api/apiError'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './SelectOrganizationPage.module.css'

const ROLE_LABELS: Record<MembershipRole, string> = {
  ADMIN: 'Administrador',
  PROJECT_MANAGER: 'Gerente de Projetos',
  DEVELOPER: 'Desenvolvedor',
  VIEWER: 'Visualizador',
}

/** Mostrada quando o usuário autenticado ainda não tem um Tenant ativo — ou porque possui mais
 * de uma Membership ACTIVE (login não escolhe por ele, ver ADR 0020) ou porque escolheu trocar
 * de organização a partir do menu do usuário. */
export function SelectOrganizationPage() {
  const { availableTenants, selectTenant, logout } = useAuth()
  const navigate = useNavigate()
  const [pendingTenantId, setPendingTenantId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSelect = useCallback(
    (tenantId: string) => {
      setPendingTenantId(tenantId)
      setError(null)
      selectTenant(tenantId)
        .then(() => navigate(ROUTES.projects, { replace: true }))
        .catch((err: unknown) => {
          setError(err instanceof ApiError ? err.message : 'Não foi possível entrar nesta organização.')
          setPendingTenantId(null)
        })
    },
    [selectTenant, navigate],
  )

  if (availableTenants.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <StatusMessage
            variant="empty"
            title="Nenhuma organização disponível."
            description="Você ainda não possui acesso a nenhuma organização."
            action={
              <button type="button" className={styles.logoutLink} onClick={() => void logout()}>
                Sair
              </button>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Selecione uma organização</h1>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <ul className={styles.list}>
          {availableTenants.map((tenant) => (
            <li key={tenant.id}>
              <button
                type="button"
                className={styles.option}
                disabled={pendingTenantId !== null}
                onClick={() => handleSelect(tenant.id)}
              >
                <span className={styles.optionName}>{tenant.name}</span>
                <span className={styles.optionMeta}>
                  {ROLE_LABELS[tenant.membershipRole]}
                  {tenant.tenantStatus === 'SUSPENDED' ? (
                    <span className={styles.suspendedBadge}>Suspensa</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <button type="button" className={styles.logoutLink} onClick={() => void logout()}>
          Sair
        </button>
      </div>
    </div>
  )
}

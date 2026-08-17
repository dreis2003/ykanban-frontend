import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { useAuth } from '@/features/auth/AuthContext'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'

interface Props {
  children: ReactNode
}

/**
 * Segurança real é sempre validada no backend — isto só evita o flash de conteúdo protegido.
 * Deliberadamente NÃO exige `isTenantSelected` (diferente de {@link RequireAuth}): um Platform
 * Admin pode não ter nenhuma Membership de Tenant (ver ADR 0023, itens 108-109) e ainda assim
 * precisa acessar `/platform`.
 */
export function RequirePlatformAdmin({ children }: Props) {
  const { isAuthenticated, isLoading, platformRoles } = useAuth()

  if (isLoading) {
    return <StatusMessage variant="loading" title="Verificando sessão…" />
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.login} replace />
  }

  if (!platformRoles.includes('PLATFORM_ADMIN')) {
    return (
      <StatusMessage
        variant="error"
        title="Acesso restrito"
        description="Esta área é exclusiva de administradores da plataforma."
      />
    )
  }

  return children
}

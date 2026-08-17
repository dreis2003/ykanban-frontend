import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { useAuth } from '@/features/auth/AuthContext'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'

interface Props {
  children: ReactNode
}

/** Segurança real é sempre validada no backend — isto só evita o flash de conteúdo protegido.
 * Exige identidade autenticada E Tenant ativo (ver ADR 0020) — sem Tenant, nenhum endpoint de
 * negócio funciona, então as telas atrás deste guard sempre redirecionam para seleção primeiro. */
export function RequireAuth({ children }: Props) {
  const { isAuthenticated, isTenantSelected, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <StatusMessage variant="loading" title="Verificando sessão…" />
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.login} replace state={{ from: location }} />
  }

  if (!isTenantSelected) {
    return <Navigate to={ROUTES.selectOrganization} replace />
  }

  return children
}

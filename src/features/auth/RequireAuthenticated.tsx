import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { useAuth } from '@/features/auth/AuthContext'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'

interface Props {
  children: ReactNode
}

/**
 * Só exige identidade — usado pela tela de seleção de Organização, que precisa ser acessível
 * tanto SEM Tenant ativo (login com múltiplas Memberships, ver ADR 0020 item 28) quanto COM um
 * Tenant já ativo (ação explícita "Trocar organização" no menu, item 69). Login com uma única
 * Membership nunca chega aqui: {@code AuthProvider#login} já resolve o Tenant automaticamente e
 * {@code RequireAuth} manda direto para /projects (item 65) — nada precisa redirecionar "de volta"
 * a partir desta tela.
 */
export function RequireAuthenticated({ children }: Props) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <StatusMessage variant="loading" title="Verificando sessão…" />
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.login} replace state={{ from: location }} />
  }

  return children
}

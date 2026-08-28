import { Navigate } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { useAuth } from '@/features/auth/AuthContext'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'

export function RootRedirect() {
  const { isAuthenticated, isTenantSelected, isLoading, platformRoles } = useAuth()

  if (isLoading) {
    return <StatusMessage variant="loading" title="Verificando sessão…" />
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.login} replace />
  }

  if (isTenantSelected) {
    return <Navigate to={ROUTES.projects} replace />
  }

  if (platformRoles.includes('PLATFORM_ADMIN')) {
    return <Navigate to={ROUTES.platformDashboard} replace />
  }

  return <Navigate to={ROUTES.selectOrganization} replace />
}

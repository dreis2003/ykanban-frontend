import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { useAuth } from '@/features/auth/AuthContext'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'

interface Props {
  children: ReactNode
}

/** Segurança real é sempre validada no backend — isto só evita o flash de conteúdo protegido. */
export function RequireAuth({ children }: Props) {
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

import { RouterProvider } from 'react-router-dom'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary/ErrorBoundary'
import { router } from '@/app/router/router'

/**
 * Ponto único de composição dos providers da aplicação. Futuros providers
 * globais (ex.: cliente de data-fetching, autenticação) entram aqui.
 */
export function AppProviders() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  )
}

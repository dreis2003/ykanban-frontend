import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary/ErrorBoundary'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { router } from '@/app/router/router'

/**
 * Cliente único para todo o app. retry:1 evita insistir demais quando o backend está fora;
 * refetchOnWindowFocus desabilitado — o padrão do TanStack Query é pensado para dashboards que
 * ficam abertos por horas, não é o caso ainda aqui.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

/**
 * Ponto único de composição dos providers da aplicação.
 */
export function AppProviders() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider, MemoryRouter } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout/MainLayout'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { AuthContext, type AuthContextValue } from '@/features/auth/AuthContext'
import { authSession } from '@/shared/api/authSession'

function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: { id: 'u1', name: 'Ana Admin', email: 'ana@ykanban.dev' },
    activeTenant: { id: 't1', name: 'Yakuza Studio', slug: 'yakuza-studio', status: 'ACTIVE' },
    membershipRole: 'DEVELOPER',
    membershipStatus: 'ACTIVE',
    authenticationContext: 'TENANT_ACCESS',
    platformRoles: [],
    availableTenants: [],
    isAuthenticated: true,
    isTenantSelected: true,
    isLoading: false,
    login: async () => undefined,
    selectTenant: async () => undefined,
    logout: async () => undefined,
    refreshAvailableTenants: async () => undefined,
    refreshSession: async () => 'TENANT_ACCESS',
    completeInvitationRegistration: async () => undefined,
    completeInvitationAcceptance: async () => undefined,
    ...overrides,
  }
}

describe('MainLayout', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    authSession.setAccessToken(null)
  })

  it('não mostra o link de administração da plataforma para quem não é Platform Admin', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={authValue()}>
          <MemoryRouter>
            <MainLayout />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    )

    expect(screen.queryByText('Administração da Plataforma')).not.toBeInTheDocument()
  })

  it('mostra o link de administração da plataforma para Platform Admin', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={authValue({ platformRoles: ['PLATFORM_ADMIN'] })}>
          <MemoryRouter>
            <MainLayout />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    )

    expect(screen.getByText('Administração da Plataforma')).toBeInTheDocument()
  })

  it('renderiza a marca YKanban no header e o conteúdo da rota filha', () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sem sessão restaurável')))

    const router = createMemoryRouter([
      {
        element: <MainLayout />,
        children: [{ path: '/', element: <p>conteúdo da página</p> }],
      },
    ])

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>,
    )

    expect(screen.getByRole('banner')).toHaveTextContent('YKanban')
    expect(screen.getByText('conteúdo da página')).toBeInTheDocument()
  })
})

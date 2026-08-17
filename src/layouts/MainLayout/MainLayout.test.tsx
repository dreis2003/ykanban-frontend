import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider, MemoryRouter } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout/MainLayout'
import { ROUTES } from '@/app/router/routes'
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

  it('sempre mostra o link Projetos, mesmo sem nenhuma role administrativa', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={authValue({ membershipRole: 'VIEWER' })}>
          <MemoryRouter>
            <MainLayout />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    )

    expect(screen.getByRole('link', { name: 'Projetos' })).toHaveAttribute('href', ROUTES.projects)
    expect(screen.queryByText('Membros')).not.toBeInTheDocument()
  })

  it('anexa returnTo ao link Membros quando a página atual está no allow-list', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={authValue({ membershipRole: 'ADMIN' })}>
          <MemoryRouter initialEntries={['/projects/11111111-1111-1111-1111-111111111111']}>
            <MainLayout />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    )

    expect(screen.getByRole('link', { name: 'Membros' })).toHaveAttribute(
      'href',
      `${ROUTES.members}?returnTo=%2Fprojects%2F11111111-1111-1111-1111-111111111111`,
    )
  })

  it('não anexa returnTo ao link Membros fora do allow-list', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={authValue({ membershipRole: 'ADMIN' })}>
          <MemoryRouter initialEntries={['/settings/members']}>
            <MainLayout />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    )

    expect(screen.getByRole('link', { name: 'Membros' })).toHaveAttribute('href', ROUTES.members)
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

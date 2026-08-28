import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { useAuth } from '@/features/auth/AuthContext'
import { authSession } from '@/shared/api/authSession'

const USER = { id: 'u1', name: 'Ana', email: 'ana@ykanban.dev' }
const TENANT = { id: 't1', name: 'Yakuza Studio', slug: 'yakuza-studio', status: 'ACTIVE' as const }

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
  } as Response
}

function renderWithProviders(children: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>)
}

function Probe() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth()
  return (
    <div>
      <span data-testid="status">
        {isLoading ? 'loading' : isAuthenticated ? 'authenticated' : 'unauthenticated'}
      </span>
      <span data-testid="user">{user?.name ?? ''}</span>
      <button onClick={() => void login('ana@ykanban.dev', 'secret')}>login</button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  )
}

describe('AuthProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    authSession.setAccessToken(null)
  })

  it('restaura a sessão existente via refresh + me ao montar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(jsonResponse({ accessToken: 't', expiresIn: 900 }))
        }
        if (url.includes('/auth/me')) {
          return Promise.resolve(
            jsonResponse({ user: USER, context: 'TENANT_ACCESS', tenant: TENANT, membership: { role: 'DEVELOPER', status: 'ACTIVE' } }),
          )
        }
        return Promise.reject(new Error(`fetch inesperado: ${url}`))
      }),
    )

    renderWithProviders(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    expect(screen.getByTestId('status')).toHaveTextContent('loading')
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    expect(screen.getByTestId('user')).toHaveTextContent('Ana')
  })

  it('fica não autenticado silenciosamente quando não há sessão restaurável', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ title: 'Sessão inválida ou expirada.', status: 401 }, 401)),
    )

    renderWithProviders(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))
    expect(screen.getByTestId('user')).toHaveTextContent('')
  })

  it('login atualiza o estado para autenticado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(jsonResponse({ title: 'x', status: 401 }, 401))
        }
        if (url.includes('/auth/login')) {
          return Promise.resolve(
            jsonResponse({
              accessToken: 't',
              expiresIn: 900,
              user: USER,
              context: 'TENANT_ACCESS',
              tenant: TENANT,
              membershipRole: 'DEVELOPER',
            }),
          )
        }
        if (url.includes('/auth/me')) {
          return Promise.resolve(
            jsonResponse({
              user: USER,
              context: 'TENANT_ACCESS',
              tenant: TENANT,
              membership: { role: 'DEVELOPER', status: 'ACTIVE' },
              platform: { roles: [] },
            }),
          )
        }
        return Promise.reject(new Error(`fetch inesperado: ${url}`))
      }),
    )

    renderWithProviders(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))

    await act(async () => {
      screen.getByText('login').click()
    })

    expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    expect(screen.getByTestId('user')).toHaveTextContent('Ana')
  })

  it('logout limpa o estado local mesmo se a chamada ao backend falhar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(jsonResponse({ accessToken: 't', expiresIn: 900 }))
        }
        if (url.includes('/auth/me')) {
          return Promise.resolve(
            jsonResponse({ user: USER, context: 'TENANT_ACCESS', tenant: TENANT, membership: { role: 'DEVELOPER', status: 'ACTIVE' } }),
          )
        }
        if (url.includes('/auth/logout')) {
          return Promise.reject(new Error('rede indisponível'))
        }
        return Promise.reject(new Error(`fetch inesperado: ${url}`))
      }),
    )

    renderWithProviders(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))

    await act(async () => {
      screen.getByText('logout').click()
    })

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))
    expect(screen.getByTestId('user')).toHaveTextContent('')
  })

  it('restaura sessão de platform admin com 0 tenants via refresh + me sem exigir activeTenant', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(jsonResponse({ accessToken: 't', expiresIn: 900 }))
        }
        if (url.includes('/auth/me')) {
          return Promise.resolve(
            jsonResponse({
              user: { id: 'admin1', name: 'Admin HML', email: 'admin-hml@seudominio.com' },
              context: 'TENANT_SELECTION',
              tenant: null,
              membership: null,
              platform: { roles: ['PLATFORM_ADMIN'] },
            }),
          )
        }
        if (url.includes('/auth/tenants')) {
          return Promise.resolve(jsonResponse([]))
        }
        return Promise.reject(new Error(`fetch inesperado: ${url}`))
      }),
    )

    function PlatformProbe() {
      const { user, isAuthenticated, platformRoles, isTenantSelected } = useAuth()
      return (
        <div>
          <span data-testid="auth">{isAuthenticated ? 'yes' : 'no'}</span>
          <span data-testid="tenant-selected">{isTenantSelected ? 'yes' : 'no'}</span>
          <span data-testid="role">{platformRoles.join(',')}</span>
          <span data-testid="email">{user?.email ?? ''}</span>
        </div>
      )
    }

    renderWithProviders(
      <AuthProvider>
        <PlatformProbe />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('yes'))
    expect(screen.getByTestId('tenant-selected')).toHaveTextContent('no')
    expect(screen.getByTestId('role')).toHaveTextContent('PLATFORM_ADMIN')
    expect(screen.getByTestId('email')).toHaveTextContent('admin-hml@seudominio.com')
  })
})

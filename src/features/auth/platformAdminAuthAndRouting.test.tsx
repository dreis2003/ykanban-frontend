import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { RequireAuthenticated } from '@/features/auth/RequireAuthenticated'
import { RequirePlatformAdmin } from '@/features/auth/RequirePlatformAdmin'
import { RootRedirect } from '@/app/router/RootRedirect'
import { LoginPage } from '@/app/pages/LoginPage/LoginPage'
import { SelectOrganizationPage } from '@/app/pages/SelectOrganizationPage/SelectOrganizationPage'
import { useAuth } from '@/features/auth/AuthContext'
import { authSession } from '@/shared/api/authSession'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
  } as Response
}

function renderApp(initialEntries: string[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/projects"
              element={
                <RequireAuth>
                  <p>área de projetos</p>
                </RequireAuth>
              }
            />
            <Route
              path="/select-organization"
              element={
                <RequireAuthenticated>
                  <SelectOrganizationPage />
                </RequireAuthenticated>
              }
            />
            <Route
              path="/platform"
              element={
                <RequirePlatformAdmin>
                  <p>dashboard da plataforma</p>
                </RequirePlatformAdmin>
              }
            />
            <Route
              path="/platform/tenants"
              element={
                <RequirePlatformAdmin>
                  <p>gestão de tenants</p>
                </RequirePlatformAdmin>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

describe('Testes Obrigatórios de Autenticação e Roteamento para PLATFORM_ADMIN', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    authSession.setAccessToken(null)
  })

  // 1. authenticated + TENANT_SELECTION + tenant null + membership null + platform.roles ["PLATFORM_ADMIN"] → /platform
  it('Cenário 1: login de PLATFORM_ADMIN com context TENANT_SELECTION, tenant null e membership null redireciona para /platform', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(jsonResponse({ title: 'unauthenticated', status: 401 }, 401))
        }
        if (url.includes('/auth/login')) {
          // Contrato real do backend: não envia platform no POST /auth/login
          return Promise.resolve(
            jsonResponse({
              accessToken: 'jwt-token-hml',
              expiresIn: 900,
              user: {
                id: '8883a83b-b7bb-4772-8bb4-a4aecece9dd6',
                name: 'Administrador HML',
                email: 'admin-hml@seudominio.com',
              },
              context: 'TENANT_SELECTION',
              tenant: null,
              membershipRole: null,
            }),
          )
        }
        if (url.includes('/auth/me')) {
          // Contrato real do backend: GET /auth/me retorna platform.roles
          return Promise.resolve(
            jsonResponse({
              user: {
                id: '8883a83b-b7bb-4772-8bb4-a4aecece9dd6',
                name: 'Administrador HML',
                email: 'admin-hml@seudominio.com',
              },
              context: 'TENANT_SELECTION',
              tenant: null,
              membership: null,
              platform: {
                roles: ['PLATFORM_ADMIN'],
              },
            }),
          )
        }
        if (url.includes('/auth/tenants')) {
          return Promise.resolve(jsonResponse([]))
        }
        return Promise.reject(new Error(`fetch inesperado: ${url}`))
      }),
    )

    renderApp(['/login'])

    await user.type(screen.getByLabelText('E-mail'), 'admin-hml@seudominio.com')
    await user.type(screen.getByLabelText('Senha'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(screen.getByText('dashboard da plataforma')).toBeInTheDocument())
    expect(screen.queryByText('Entrar')).not.toBeInTheDocument()
  })

  // 2. mesmo cenário acessando /platform diretamente → permitido
  it('Cenário 2: PLATFORM_ADMIN sem tenant acessando /platform diretamente tem acesso permitido', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(jsonResponse({ accessToken: 'valid-token', expiresIn: 900 }))
        }
        if (url.includes('/auth/me')) {
          return Promise.resolve(
            jsonResponse({
              user: {
                id: '8883a83b-b7bb-4772-8bb4-a4aecece9dd6',
                name: 'Administrador HML',
                email: 'admin-hml@seudominio.com',
              },
              context: 'TENANT_SELECTION',
              tenant: null,
              membership: null,
              platform: {
                roles: ['PLATFORM_ADMIN'],
              },
            }),
          )
        }
        if (url.includes('/auth/tenants')) {
          return Promise.resolve(jsonResponse([]))
        }
        return Promise.reject(new Error(`fetch inesperado: ${url}`))
      }),
    )

    renderApp(['/platform'])

    await waitFor(() => expect(screen.getByText('dashboard da plataforma')).toBeInTheDocument())
  })

  // 3. mesmo cenário com F5/restore session → continua /platform
  it('Cenário 3: F5/restore session em /platform mantém usuário autenticado e na página /platform', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(jsonResponse({ accessToken: 'restored-token', expiresIn: 900 }))
        }
        if (url.includes('/auth/me')) {
          return Promise.resolve(
            jsonResponse({
              user: {
                id: '8883a83b-b7bb-4772-8bb4-a4aecece9dd6',
                name: 'Administrador HML',
                email: 'admin-hml@seudominio.com',
              },
              context: 'TENANT_SELECTION',
              tenant: null,
              membership: null,
              platform: {
                roles: ['PLATFORM_ADMIN'],
              },
            }),
          )
        }
        if (url.includes('/auth/tenants')) {
          return Promise.resolve(jsonResponse([]))
        }
        return Promise.reject(new Error(`fetch inesperado: ${url}`))
      }),
    )

    renderApp(['/platform/tenants'])

    await waitFor(() => expect(screen.getByText('gestão de tenants')).toBeInTheDocument())
    expect(screen.queryByText('Entrar')).not.toBeInTheDocument()
  })

  // 4. PLATFORM_ADMIN sem Tenant → não executa logout
  it('Cenário 4: PLATFORM_ADMIN sem Tenant não executa logout automático', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(jsonResponse({ accessToken: 'valid-token', expiresIn: 900 }))
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

    function StatusProbe() {
      const { isAuthenticated, user, isTenantSelected, platformRoles } = useAuth()
      return (
        <div>
          <span data-testid="auth">{isAuthenticated ? 'yes' : 'no'}</span>
          <span data-testid="user">{user?.email ?? ''}</span>
          <span data-testid="tenant-selected">{isTenantSelected ? 'yes' : 'no'}</span>
          <span data-testid="roles">{platformRoles.join(',')}</span>
        </div>
      )
    }

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusProbe />
        </AuthProvider>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('yes'))
    expect(screen.getByTestId('user')).toHaveTextContent('admin-hml@seudominio.com')
    expect(screen.getByTestId('tenant-selected')).toHaveTextContent('no')
    expect(screen.getByTestId('roles')).toHaveTextContent('PLATFORM_ADMIN')
  })

  // 5. PLATFORM_ADMIN sem Tenant → não redireciona /login
  it('Cenário 5: PLATFORM_ADMIN sem Tenant acessando rota raiz (/) vai para /platform, nunca /login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(jsonResponse({ accessToken: 'valid-token', expiresIn: 900 }))
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

    renderApp(['/'])

    await waitFor(() => expect(screen.getByText('dashboard da plataforma')).toBeInTheDocument())
    expect(screen.queryByText('Entrar')).not.toBeInTheDocument()
  })

  // 6. authenticated + 0 Tenant + sem PLATFORM_ADMIN → estado sem organização
  it('Cenário 6: usuário autenticado sem tenants e sem PLATFORM_ADMIN exibe estado sem organização sem ir para /login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(jsonResponse({ accessToken: 'valid-token', expiresIn: 900 }))
        }
        if (url.includes('/auth/me')) {
          return Promise.resolve(
            jsonResponse({
              user: { id: 'user1', name: 'User Sem Org', email: 'user@example.com' },
              context: 'TENANT_SELECTION',
              tenant: null,
              membership: null,
              platform: { roles: [] },
            }),
          )
        }
        if (url.includes('/auth/tenants')) {
          return Promise.resolve(jsonResponse([]))
        }
        return Promise.reject(new Error(`fetch inesperado: ${url}`))
      }),
    )

    renderApp(['/select-organization'])

    await waitFor(() => {
      expect(screen.getByText('Você ainda não possui uma organização.')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
    expect(screen.queryByText('Entrar')).not.toBeInTheDocument()
  })

  // 7. unauthenticated → /login
  it('Cenário 7: usuário não autenticado é redirecionado para /login ao acessar rota protegida', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ title: 'unauthenticated', status: 401 }, 401)),
    )

    renderApp(['/projects'])

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument()
    })
  })

  // 8. TENANT_ACCESS válido → comportamento Tenant preservado
  it('Cenário 8: usuário com TENANT_ACCESS válido acessa a aplicação Tenant normalmente (/projects)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(jsonResponse({ accessToken: 'tenant-token', expiresIn: 900 }))
        }
        if (url.includes('/auth/me')) {
          return Promise.resolve(
            jsonResponse({
              user: { id: 'dev1', name: 'Dev User', email: 'dev@ykanban.dev' },
              context: 'TENANT_ACCESS',
              tenant: { id: 't1', name: 'Empresa Alfa', slug: 'empresa-alfa', status: 'ACTIVE' },
              membership: { role: 'DEVELOPER', status: 'ACTIVE' },
              platform: { roles: [] },
            }),
          )
        }
        return Promise.reject(new Error(`fetch inesperado: ${url}`))
      }),
    )

    renderApp(['/'])

    await waitFor(() => {
      expect(screen.getByText('área de projetos')).toBeInTheDocument()
    })
  })

  // 9. usuário sem Membership tentando TenantRoute → acesso negado
  it('Cenário 9: usuário sem Tenant ativo tentando acessar rota de Tenant (/projects) é redirecionado para /select-organization', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(jsonResponse({ accessToken: 'valid-token', expiresIn: 900 }))
        }
        if (url.includes('/auth/me')) {
          return Promise.resolve(
            jsonResponse({
              user: { id: 'user1', name: 'User Multi', email: 'user@example.com' },
              context: 'TENANT_SELECTION',
              tenant: null,
              membership: null,
              platform: { roles: [] },
            }),
          )
        }
        if (url.includes('/auth/tenants')) {
          return Promise.resolve(
            jsonResponse([
              { id: 't1', name: 'Org 1', slug: 'org-1', tenantStatus: 'ACTIVE', membershipRole: 'ADMIN' },
              { id: 't2', name: 'Org 2', slug: 'org-2', tenantStatus: 'ACTIVE', membershipRole: 'DEVELOPER' },
            ]),
          )
        }
        return Promise.reject(new Error(`fetch inesperado: ${url}`))
      }),
    )

    renderApp(['/projects'])

    await waitFor(() => {
      expect(screen.getByText('Selecione uma organização')).toBeInTheDocument()
    })
    expect(screen.queryByText('área de projetos')).not.toBeInTheDocument()
  })

  // 10. platform.roles vazio → /platform negado
  it('Cenário 10: usuário autenticado com platform.roles vazio tem acesso negado a /platform (Acesso restrito)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(jsonResponse({ accessToken: 'valid-token', expiresIn: 900 }))
        }
        if (url.includes('/auth/me')) {
          return Promise.resolve(
            jsonResponse({
              user: { id: 'user1', name: 'User Comum', email: 'user@example.com' },
              context: 'TENANT_SELECTION',
              tenant: null,
              membership: null,
              platform: { roles: [] },
            }),
          )
        }
        if (url.includes('/auth/tenants')) {
          return Promise.resolve(jsonResponse([]))
        }
        return Promise.reject(new Error(`fetch inesperado: ${url}`))
      }),
    )

    renderApp(['/platform'])

    await waitFor(() => {
      expect(screen.getByText('Acesso restrito')).toBeInTheDocument()
    })
    expect(
      screen.getByText('Esta área é exclusiva de administradores da plataforma.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('dashboard da plataforma')).not.toBeInTheDocument()
  })

  // 11. platform.roles contendo PLATFORM_ADMIN → /platform permitido
  it('Cenário 11: usuário autenticado com platform.roles contendo PLATFORM_ADMIN tem acesso permitido a /platform', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(jsonResponse({ accessToken: 'admin-token', expiresIn: 900 }))
        }
        if (url.includes('/auth/me')) {
          return Promise.resolve(
            jsonResponse({
              user: { id: 'adm', name: 'Platform Admin', email: 'platform-admin@domain.com' },
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

    renderApp(['/platform'])

    await waitFor(() => {
      expect(screen.getByText('dashboard da plataforma')).toBeInTheDocument()
    })
  })

  // 12. lista de tenants [] → não invalida autenticação
  it('Cenário 12: GET /auth/tenants retornando lista vazia ([]) não invalida autenticação', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(jsonResponse({ accessToken: 'valid-token', expiresIn: 900 }))
        }
        if (url.includes('/auth/me')) {
          return Promise.resolve(
            jsonResponse({
              user: { id: 'u1', name: 'User Sem Tenant', email: 'sem-tenant@domain.com' },
              context: 'TENANT_SELECTION',
              tenant: null,
              membership: null,
              platform: { roles: [] },
            }),
          )
        }
        if (url.includes('/auth/tenants')) {
          return Promise.resolve(jsonResponse([]))
        }
        return Promise.reject(new Error(`fetch inesperado: ${url}`))
      }),
    )

    function TenantProbe() {
      const { isAuthenticated, availableTenants } = useAuth()
      return (
        <div>
          <span data-testid="auth">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</span>
          <span data-testid="count">{availableTenants.length}</span>
        </div>
      )
    }

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TenantProbe />
        </AuthProvider>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('authenticated'))
    expect(screen.getByTestId('count')).toHaveTextContent('0')
    expect(authSession.getAccessToken()).toBe('valid-token')
  })
})

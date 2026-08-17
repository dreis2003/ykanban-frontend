import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { MembersPage } from '@/app/pages/MembersPage/MembersPage'
import { AuthContext, type AuthContextValue } from '@/features/auth/AuthContext'
import { authSession } from '@/shared/api/authSession'

interface FetchHandler {
  match: (url: string, method: string) => boolean
  respond: () => Response | Promise<Response>
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' }),
    json: () => Promise.resolve(body),
  } as Response
}

function pageOf(items: unknown[]) {
  return { content: items, page: 0, size: 20, totalElements: items.length, totalPages: items.length > 0 ? 1 : 0 }
}

function mockFetchRouter(handlers: FetchHandler[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString()
      const method = (init?.method ?? 'GET').toUpperCase()
      const handler = handlers.find((h) => h.match(url, method))
      if (!handler) {
        return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
      }
      return Promise.resolve(handler.respond())
    }),
  )
}

const ADMIN_MEMBER = {
  membershipId: 'm1',
  userId: 'u1',
  name: 'Ana Admin',
  email: 'ana@ykanban.dev',
  role: 'ADMIN',
  status: 'ACTIVE',
  joinedAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const DEV_MEMBER = {
  membershipId: 'm2',
  userId: 'u2',
  name: 'Beto Dev',
  email: 'beto@ykanban.dev',
  role: 'DEVELOPER',
  status: 'ACTIVE',
  joinedAt: '2026-02-01T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z',
}

function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: { id: 'u1', name: 'Ana Admin', email: 'ana@ykanban.dev' },
    activeTenant: { id: 't1', name: 'Yakuza Studio', slug: 'yakuza-studio', status: 'ACTIVE' },
    membershipRole: 'ADMIN',
    membershipStatus: 'ACTIVE',
    authenticationContext: 'TENANT_ACCESS',
    availableTenants: [],
    isAuthenticated: true,
    isTenantSelected: true,
    isLoading: false,
    login: async () => undefined,
    selectTenant: async () => undefined,
    logout: async () => undefined,
    refreshAvailableTenants: async () => undefined,
    refreshSession: async () => 'TENANT_ACCESS',
    ...overrides,
  }
}

function renderMembersPage(auth: AuthContextValue = authValue()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter>
          <MembersPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('MembersPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    authSession.setAccessToken(null)
  })

  it('mostra loading e depois a lista de membros', async () => {
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.includes('/members?'), respond: () => jsonResponse(pageOf([ADMIN_MEMBER, DEV_MEMBER])) },
    ])

    renderMembersPage()

    expect(screen.getByText('Carregando membros…')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Ana Admin')).toBeInTheDocument())
    expect(screen.getByText('Beto Dev')).toBeInTheDocument()
    expect(screen.getByText('você')).toBeInTheDocument()
  })

  it('redireciona quem não é ADMIN para /projects', () => {
    mockFetchRouter([])

    renderMembersPage(authValue({ membershipRole: 'DEVELOPER' }))

    expect(screen.queryByText('Membros')).not.toBeInTheDocument()
  })

  it('filtra por busca', async () => {
    const requestedUrls: string[] = []
    mockFetchRouter([
      {
        match: (url, method) => method === 'GET' && url.includes('/members?'),
        respond: () => {
          requestedUrls.push('')
          return jsonResponse(pageOf([ADMIN_MEMBER, DEV_MEMBER]))
        },
      },
    ])
    const user = userEvent.setup()

    renderMembersPage()
    await waitFor(() => expect(screen.getByText('Ana Admin')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText('Buscar por nome ou e-mail...'), 'beto')

    await waitFor(() =>
      expect(
        (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.some((call) =>
          String(call[0]).includes('search=beto'),
        ),
      ).toBe(true),
    )
  })

  it('altera o papel de um membro com sucesso', async () => {
    const user = userEvent.setup()
    let updated = false
    mockFetchRouter([
      {
        match: (url, method) => method === 'GET' && url.includes('/members?'),
        respond: () =>
          jsonResponse(pageOf([ADMIN_MEMBER, updated ? { ...DEV_MEMBER, role: 'PROJECT_MANAGER' } : DEV_MEMBER])),
      },
      {
        match: (url, method) => method === 'PUT' && url.includes('/members/m2/role'),
        respond: () => {
          updated = true
          return jsonResponse({ ...DEV_MEMBER, role: 'PROJECT_MANAGER' })
        },
      },
    ])

    renderMembersPage()
    await waitFor(() => expect(screen.getByText('Beto Dev')).toBeInTheDocument())

    const row = screen.getByText('Beto Dev').closest('tr')
    expect(row).not.toBeNull()
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Alterar papel' }))

    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('radio', { name: /Gerente de Projetos/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('mostra erro de último admin ativo ao tentar alterar papel', async () => {
    const user = userEvent.setup()
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.includes('/members?'), respond: () => jsonResponse(pageOf([ADMIN_MEMBER])) },
      {
        match: (url, method) => method === 'PUT' && url.includes('/members/m1/role'),
        respond: () =>
          jsonResponse(
            { title: 'Conflito', status: 409, detail: 'A organização deve possuir pelo menos um administrador ativo.' },
            409,
          ),
      },
    ])

    renderMembersPage()
    await waitFor(() => expect(screen.getByText('Ana Admin')).toBeInTheDocument())

    const row = screen.getByText('Ana Admin').closest('tr')
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Alterar papel' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('radio', { name: /Visualizador/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('A organização deve possuir pelo menos um administrador ativo.')).toBeInTheDocument()
  })

  it('desativa um membro após confirmação', async () => {
    const user = userEvent.setup()
    let deactivated = false
    mockFetchRouter([
      {
        match: (url, method) => method === 'GET' && url.includes('/members?'),
        respond: () => jsonResponse(pageOf([ADMIN_MEMBER, { ...DEV_MEMBER, status: deactivated ? 'INACTIVE' : 'ACTIVE' }])),
      },
      {
        match: (url, method) => method === 'POST' && url.includes('/members/m2/deactivate'),
        respond: () => {
          deactivated = true
          return jsonResponse({ ...DEV_MEMBER, status: 'INACTIVE' })
        },
      },
    ])

    renderMembersPage()
    await waitFor(() => expect(screen.getByText('Beto Dev')).toBeInTheDocument())

    const row = screen.getByText('Beto Dev').closest('tr')
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Desativar' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Desativar' }))

    await waitFor(() => expect(screen.getByText('Inativo')).toBeInTheDocument())
  })

  it('ao remover a própria Membership, resincroniza a sessão e sai da tela', async () => {
    const user = userEvent.setup()
    const refreshSession = vi.fn().mockResolvedValue('TENANT_SELECTION')
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.includes('/members?'), respond: () => jsonResponse(pageOf([ADMIN_MEMBER])) },
      { match: (url, method) => method === 'DELETE' && url.includes('/members/m1'), respond: () => jsonResponse(undefined, 204) },
    ])

    renderMembersPage(authValue({ refreshSession }))
    await waitFor(() => expect(screen.getByText('Ana Admin')).toBeInTheDocument())

    const row = screen.getByText('Ana Admin').closest('tr')
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Remover' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Remover' }))

    await waitFor(() => expect(refreshSession).toHaveBeenCalled())
  })
})

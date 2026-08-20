import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AccountPage } from '@/app/pages/AccountPage/AccountPage'
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
    headers: new Headers({
      'content-type': status >= 400 ? 'application/problem+json' : status === 204 ? '' : 'application/json',
    }),
    json: () => Promise.resolve(body),
  } as Response
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

const ACCOUNT = {
  id: 'u1',
  name: 'Ana Silva',
  email: 'ana@empresa.com',
  status: 'ACTIVE',
  emailVerified: true,
  emailVerifiedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  pendingEmailChange: null,
}

function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: { id: 'u1', name: 'Ana Silva', email: 'ana@empresa.com' },
    activeTenant: null,
    membershipRole: null,
    membershipStatus: null,
    authenticationContext: 'TENANT_SELECTION',
    platformRoles: [],
    availableTenants: [],
    isAuthenticated: true,
    isTenantSelected: false,
    isLoading: false,
    login: async () => undefined,
    selectTenant: async () => undefined,
    logout: vi.fn().mockResolvedValue(undefined),
    refreshAvailableTenants: async () => undefined,
    refreshSession: vi.fn().mockResolvedValue('TENANT_SELECTION'),
    completeInvitationRegistration: async () => undefined,
    completeInvitationAcceptance: async () => undefined,
    ...overrides,
  }
}

function renderPage(auth: AuthContextValue = authValue()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/account']}>
          <AccountPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('AccountPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    authSession.setAccessToken(null)
  })

  it('mostra o perfil atual', async () => {
    mockFetchRouter([{ match: (url, method) => method === 'GET' && url.includes('/account'), respond: () => jsonResponse(ACCOUNT) }])

    renderPage()

    expect(await screen.findByDisplayValue('Ana Silva')).toBeInTheDocument()
    expect(screen.getByDisplayValue('ana@empresa.com')).toBeInTheDocument()
  })

  it('atualiza o nome do perfil', async () => {
    const user = userEvent.setup()
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.includes('/account'), respond: () => jsonResponse(ACCOUNT) },
      {
        match: (url, method) => method === 'PATCH' && url.includes('/account/profile'),
        respond: () => jsonResponse({ ...ACCOUNT, name: 'Ana Paula Silva' }),
      },
    ])

    renderPage()
    const nameInput = await screen.findByDisplayValue('Ana Silva')
    await user.clear(nameInput)
    await user.type(nameInput, 'Ana Paula Silva')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Perfil atualizado.')).toBeInTheDocument()
  })

  it('altera a senha e força logout imediatamente', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ delay: null })
    const logout = vi.fn().mockResolvedValue(undefined)
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.includes('/account'), respond: () => jsonResponse(ACCOUNT) },
      {
        match: (url, method) => method === 'POST' && url.includes('/account/password/change'),
        respond: () => jsonResponse(undefined, 204),
      },
    ])

    renderPage(authValue({ logout }))
    await screen.findByDisplayValue('Ana Silva')

    await user.type(screen.getByLabelText('Senha atual', { selector: '#current-password' }), 'Sup3rSecret!42')
    await user.type(screen.getByLabelText('Nova senha'), 'N3wPassword!42')
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'N3wPassword!42')
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('desconectado')

    await vi.advanceTimersByTimeAsync(2500)
    expect(logout).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('rejeita senhas novas que não coincidem sem chamar a API', async () => {
    const user = userEvent.setup()
    mockFetchRouter([{ match: (url, method) => method === 'GET' && url.includes('/account'), respond: () => jsonResponse(ACCOUNT) }])

    renderPage()
    await screen.findByDisplayValue('Ana Silva')

    await user.type(screen.getByLabelText('Senha atual', { selector: '#current-password' }), 'Sup3rSecret!42')
    await user.type(screen.getByLabelText('Nova senha'), 'N3wPassword!42')
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'Different!42')
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }))

    expect(await screen.findByText('As senhas não coincidem.')).toBeInTheDocument()
  })

  it('solicita troca de e-mail', async () => {
    const user = userEvent.setup()
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.includes('/account'), respond: () => jsonResponse(ACCOUNT) },
      {
        match: (url, method) => method === 'POST' && url.includes('/account/email-change') && !url.includes('resend') && !url.includes('cancel'),
        respond: () => jsonResponse(undefined, 202),
      },
    ])

    renderPage()
    await screen.findByDisplayValue('Ana Silva')

    await user.type(screen.getByLabelText('Novo e-mail'), 'novo@empresa.com')
    await user.type(screen.getByLabelText('Senha atual', { selector: '#email-change-password' }), 'Sup3rSecret!42')
    await user.click(screen.getByRole('button', { name: 'Solicitar troca de e-mail' }))

    expect(await screen.findByText('Enviamos um e-mail de confirmação para o novo endereço.')).toBeInTheDocument()
  })

  it('mostra troca de e-mail pendente com opções de reenviar/cancelar', async () => {
    mockFetchRouter([
      {
        match: (url, method) => method === 'GET' && url.includes('/account'),
        respond: () =>
          jsonResponse({
            ...ACCOUNT,
            pendingEmailChange: { maskedNewEmail: 'n***@empresa.com', expiresAt: '2026-01-02T00:00:00Z' },
          }),
      },
    ])

    renderPage()

    expect(await screen.findByText(/Confirmação pendente para/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reenviar e-mail de confirmação' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('encerra todas as sessões e força logout imediatamente', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ delay: null })
    const logout = vi.fn().mockResolvedValue(undefined)
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.includes('/account'), respond: () => jsonResponse(ACCOUNT) },
      {
        match: (url, method) => method === 'POST' && url.includes('/account/sessions/revoke-all'),
        respond: () => jsonResponse(undefined, 204),
      },
    ])

    renderPage(authValue({ logout }))
    await screen.findByDisplayValue('Ana Silva')

    await user.click(screen.getByRole('button', { name: 'Sair de todos os dispositivos' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Todas as sessões foram encerradas')
    await vi.advanceTimersByTimeAsync(2500)
    await waitFor(() => expect(logout).toHaveBeenCalled())
    vi.useRealTimers()
  })
})

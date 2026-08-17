import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AcceptInvitationPage } from '@/app/pages/AcceptInvitationPage/AcceptInvitationPage'
import { AuthContext, type AuthContextValue } from '@/features/auth/AuthContext'
import { authSession } from '@/shared/api/authSession'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' }),
    json: () => Promise.resolve(body),
  } as Response
}

const VALID_PUBLIC = {
  valid: true,
  status: 'PENDING',
  organization: { name: 'Yakuza Studio' },
  email: 'maria@ykanban.dev',
  role: 'DEVELOPER',
  expiresAt: '2026-03-04T12:00:00Z',
}

function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    activeTenant: null,
    membershipRole: null,
    membershipStatus: null,
    authenticationContext: null,
    platformRoles: [],
    availableTenants: [],
    isAuthenticated: false,
    isTenantSelected: false,
    isLoading: false,
    login: async () => undefined,
    selectTenant: async () => undefined,
    logout: async () => undefined,
    refreshAvailableTenants: async () => undefined,
    refreshSession: async () => 'TENANT_SELECTION',
    completeInvitationRegistration: async () => undefined,
    completeInvitationAcceptance: async () => undefined,
    ...overrides,
  }
}

function renderPage(auth: AuthContextValue = authValue(), token = 'tok123') {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[`/invitations/${token}`]}>
        <Routes>
          <Route path="/invitations/:token" element={<AcceptInvitationPage />} />
          <Route path="/login" element={<div>Página de login</div>} />
          <Route path="/projects" element={<div>Página de projetos</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('AcceptInvitationPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    authSession.setAccessToken(null)
  })

  it('mostra os dados do convite válido e as opções para visitante não autenticado', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(VALID_PUBLIC))))

    renderPage()

    expect(await screen.findByText('Yakuza Studio')).toBeInTheDocument()
    expect(screen.getByText('Desenvolvedor')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Já tenho uma conta' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Criar minha conta' })).toBeInTheDocument()
  })

  it('mostra mensagem de convite expirado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ valid: false, status: 'EXPIRED', organization: null, email: null, role: null, expiresAt: null }))),
    )

    renderPage()

    expect(await screen.findByText('Este convite expirou.')).toBeInTheDocument()
    expect(screen.getByText('Peça a um administrador da organização para enviar um novo convite.')).toBeInTheDocument()
  })

  it('mostra mensagem de convite revogado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ valid: false, status: 'REVOKED', organization: null, email: null, role: null, expiresAt: null }))),
    )

    renderPage()

    expect(await screen.findByText('Este convite não está mais disponível.')).toBeInTheDocument()
  })

  it('mostra mensagem de convite inválido para token desconhecido', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ valid: false, status: null, organization: null, email: null, role: null, expiresAt: null }))),
    )

    renderPage()

    expect(await screen.findByText('Este convite não é mais válido.')).toBeInTheDocument()
  })

  it('cria conta e aceita o convite para visitante não autenticado', async () => {
    const user = userEvent.setup()
    const completeInvitationRegistration = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString()
        const method = (init?.method ?? 'GET').toUpperCase()
        if (method === 'GET' && url.includes('/public/invitations/')) {
          return Promise.resolve(jsonResponse(VALID_PUBLIC))
        }
        if (method === 'POST' && url.includes('/register')) {
          return Promise.resolve(
            jsonResponse({
              accessToken: 'jwt',
              expiresIn: 900,
              user: { id: 'u9', name: 'Maria Silva', email: 'maria@ykanban.dev' },
              context: 'TENANT_ACCESS',
              tenant: { id: 't1', name: 'Yakuza Studio', slug: 'yakuza-studio', status: 'ACTIVE' },
              membershipRole: 'DEVELOPER',
            }),
          )
        }
        return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
      }),
    )

    renderPage(authValue({ completeInvitationRegistration }))
    await screen.findByText('Yakuza Studio')

    await user.click(screen.getByRole('button', { name: 'Criar minha conta' }))
    await user.type(screen.getByLabelText('Nome'), 'Maria Silva')
    const emailInput = screen.getByLabelText('E-mail') as HTMLInputElement
    expect(emailInput).toBeDisabled()
    expect(emailInput.value).toBe('maria@ykanban.dev')
    await user.type(screen.getByLabelText('Senha'), 'Sup3rSecret!')
    await user.type(screen.getByLabelText('Confirmar senha'), 'Sup3rSecret!')
    await user.click(screen.getByRole('button', { name: 'Criar conta e aceitar convite' }))

    await waitFor(() => expect(completeInvitationRegistration).toHaveBeenCalled())
    expect(await screen.findByText('Página de projetos')).toBeInTheDocument()
  })

  it('mostra erro quando as senhas não coincidem', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(VALID_PUBLIC))))

    renderPage()
    await screen.findByText('Yakuza Studio')

    await user.click(screen.getByRole('button', { name: 'Criar minha conta' }))
    await user.type(screen.getByLabelText('Nome'), 'Maria Silva')
    await user.type(screen.getByLabelText('Senha'), 'Sup3rSecret!')
    await user.type(screen.getByLabelText('Confirmar senha'), 'OutraSenha!')
    await user.click(screen.getByRole('button', { name: 'Criar conta e aceitar convite' }))

    expect(await screen.findByText('As senhas não coincidem.')).toBeInTheDocument()
  })

  it('aceita o convite automaticamente para usuário autenticado com e-mail correspondente', async () => {
    const user = userEvent.setup()
    const completeInvitationAcceptance = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString()
        const method = (init?.method ?? 'GET').toUpperCase()
        if (method === 'GET' && url.includes('/public/invitations/')) {
          return Promise.resolve(jsonResponse(VALID_PUBLIC))
        }
        if (method === 'POST' && url.includes('/accept')) {
          return Promise.resolve(
            jsonResponse({
              accessToken: 'jwt',
              expiresIn: 900,
              tenant: { id: 't1', name: 'Yakuza Studio', slug: 'yakuza-studio', status: 'ACTIVE' },
              membershipRole: 'DEVELOPER',
            }),
          )
        }
        return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
      }),
    )

    renderPage(
      authValue({
        isAuthenticated: true,
        user: { id: 'u1', name: 'Maria Silva', email: 'maria@ykanban.dev' },
        completeInvitationAcceptance,
      }),
    )
    await screen.findByText('Yakuza Studio')

    await user.click(screen.getByRole('button', { name: 'Aceitar convite' }))

    await waitFor(() => expect(completeInvitationAcceptance).toHaveBeenCalled())
    expect(await screen.findByText('Página de projetos')).toBeInTheDocument()
  })

  it('mostra aviso de conta incompatível quando o e-mail autenticado é diferente do convite', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(VALID_PUBLIC))))

    renderPage(
      authValue({
        isAuthenticated: true,
        user: { id: 'u2', name: 'João', email: 'joao@ykanban.dev' },
      }),
    )

    expect(await screen.findByText(/mas você está conectado com outra conta/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair e entrar com outra conta' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aceitar convite' })).not.toBeInTheDocument()
  })
})

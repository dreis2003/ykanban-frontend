import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AccountSetupPage } from '@/app/pages/AccountSetupPage/AccountSetupPage'
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

const VALID: unknown = {
  valid: true,
  organizationName: 'Empresa ABC',
  maskedEmail: 'c***@empresa.com',
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

function renderPage(auth: AuthContextValue = authValue()) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/account-setup']}>
        <Routes>
          <Route path="/account-setup" element={<AccountSetupPage />} />
          <Route path="/login" element={<div>Página de login</div>} />
          <Route path="/subscribe" element={<div>Página de planos</div>} />
          <Route path="/projects" element={<div>Página de projetos</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('AccountSetupPage', () => {
  beforeEach(() => {
    window.location.hash = '#token=raw-token-abc'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    authSession.setAccessToken(null)
    window.sessionStorage.clear()
    window.location.hash = ''
  })

  it('mostra link inválido quando não há token no fragment nem em sessionStorage', async () => {
    window.location.hash = ''
    vi.stubGlobal('fetch', vi.fn())

    renderPage()

    expect(await screen.findByText('Este link de ativação não é mais válido.')).toBeInTheDocument()
  })

  it('valida o token e mostra o formulário de criação de conta', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(VALID))))

    renderPage()

    expect(await screen.findByText('Crie seu acesso administrativo.')).toBeInTheDocument()
    const emailInput = screen.getByLabelText('E-mail') as HTMLInputElement
    expect(emailInput).toBeDisabled()
    expect(emailInput.value).toBe('c***@empresa.com')
    // O token some da barra de endereço assim que lido (ver item 133).
    expect(window.location.hash).toBe('')
  })

  it('cria a conta e faz login automático para usuário novo', async () => {
    const user = userEvent.setup()
    const completeInvitationRegistration = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString()
        const method = (init?.method ?? 'GET').toUpperCase()
        if (url.includes('/public/account-setup/validate')) {
          return Promise.resolve(jsonResponse(VALID))
        }
        if (url.includes('/public/account-setup/register') && method === 'POST') {
          return Promise.resolve(
            jsonResponse({
              accessToken: 'jwt',
              expiresIn: 900,
              user: { id: 'u1', name: 'João Silva', email: 'cliente@empresa.com' },
              context: 'TENANT_ACCESS',
              tenant: { id: 't1', name: 'Empresa ABC', slug: 'empresa-abc', status: 'ACTIVE' },
              membershipRole: 'ADMIN',
            }),
          )
        }
        return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
      }),
    )

    renderPage(authValue({ completeInvitationRegistration }))
    await screen.findByText('Crie seu acesso administrativo.')

    await user.type(screen.getByLabelText('Nome'), 'João Silva')
    await user.type(screen.getByLabelText('Senha'), 'Sup3rSecret!')
    await user.type(screen.getByLabelText('Confirmar senha'), 'Sup3rSecret!')
    await user.click(screen.getByRole('button', { name: 'Criar meu acesso' }))

    await waitFor(() => expect(completeInvitationRegistration).toHaveBeenCalled())
    expect(await screen.findByText('Página de projetos')).toBeInTheDocument()
  })

  it('mostra opção de login quando o e-mail já possui conta', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString()
        const method = (init?.method ?? 'GET').toUpperCase()
        if (url.includes('/public/account-setup/validate')) {
          return Promise.resolve(jsonResponse(VALID))
        }
        if (url.includes('/public/account-setup/register') && method === 'POST') {
          return Promise.resolve(
            jsonResponse(
              {
                type: 'https://ykanban.yakuzastudio.com/problems/account-already-exists-login-required',
                title: 'Conta já existe',
                status: 409,
                detail: 'Este e-mail já possui uma conta no YKanban.',
                code: 'ACCOUNT_ALREADY_EXISTS_LOGIN_REQUIRED',
              },
              409,
            ),
          )
        }
        return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
      }),
    )

    renderPage()
    await screen.findByText('Crie seu acesso administrativo.')

    await user.type(screen.getByLabelText('Nome'), 'João Silva')
    await user.type(screen.getByLabelText('Senha'), 'Sup3rSecret!')
    await user.type(screen.getByLabelText('Confirmar senha'), 'Sup3rSecret!')
    await user.click(screen.getByRole('button', { name: 'Criar meu acesso' }))

    expect(await screen.findByText('Este e-mail já possui uma conta no YKanban.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar e continuar' })).toBeInTheDocument()
  })

  it('permite usuário já autenticado assumir a administração da empresa', async () => {
    const user = userEvent.setup()
    const completeInvitationAcceptance = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString()
        const method = (init?.method ?? 'GET').toUpperCase()
        if (url.includes('/public/account-setup/validate')) {
          return Promise.resolve(jsonResponse(VALID))
        }
        if (url.includes('/account-setup/accept') && method === 'POST') {
          return Promise.resolve(
            jsonResponse({
              accessToken: 'jwt',
              expiresIn: 900,
              tenant: { id: 't1', name: 'Empresa ABC', slug: 'empresa-abc', status: 'ACTIVE' },
              membershipRole: 'ADMIN',
            }),
          )
        }
        return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
      }),
    )

    renderPage(
      authValue({
        isAuthenticated: true,
        user: { id: 'u1', name: 'Maria', email: 'maria@empresa.com' },
        completeInvitationAcceptance,
      }),
    )

    await screen.findByText('Assumir a administração desta empresa?')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    await waitFor(() => expect(completeInvitationAcceptance).toHaveBeenCalled())
    expect(await screen.findByText('Página de projetos')).toBeInTheDocument()
  })
})

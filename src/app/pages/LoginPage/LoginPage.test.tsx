import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LoginPage } from '@/app/pages/LoginPage/LoginPage'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { authSession } from '@/shared/api/authSession'

const AUTH_USER = { id: 'u1', name: 'Ana', email: 'ana@ykanban.dev' }
const TENANT = { id: 't1', name: 'Yakuza Studio', slug: 'yakuza-studio', status: 'ACTIVE' }

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
  } as Response
}

function renderLoginPage(initialEntries = ['/login']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/projects" element={<p>página de projetos</p>} />
            <Route path="/select-organization" element={<p>seleção de organização</p>} />
            <Route path="/platform" element={<p>dashboard da plataforma</p>} />
            <Route path="/platform/tenants" element={<p>tenants da plataforma</p>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

describe('LoginPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    authSession.setAccessToken(null)
  })

  it('renderiza os campos de e-mail e senha', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ title: 'x', status: 401 }, 401)))

    renderLoginPage()

    expect(screen.getByLabelText('E-mail')).toBeInTheDocument()
    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('faz login com 1 tenant e navega para /projects', async () => {
    const user = userEvent.setup()
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
              user: AUTH_USER,
              context: 'TENANT_ACCESS',
              tenant: TENANT,
              membershipRole: 'DEVELOPER',
            }),
          )
        }
        if (url.includes('/auth/me')) {
          return Promise.resolve(
            jsonResponse({
              user: AUTH_USER,
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

    renderLoginPage()

    await user.type(screen.getByLabelText('E-mail'), 'ana@ykanban.dev')
    await user.type(screen.getByLabelText('Senha'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(screen.getByText('página de projetos')).toBeInTheDocument())
  })

  it('faz login com 2+ tenants e navega para /select-organization', async () => {
    const user = userEvent.setup()
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
              user: AUTH_USER,
              context: 'TENANT_SELECTION',
              tenant: null,
              membershipRole: null,
            }),
          )
        }
        if (url.includes('/auth/tenants')) {
          return Promise.resolve(
            jsonResponse([
              { id: 't1', name: 'Tenant 1', slug: 't1', tenantStatus: 'ACTIVE', membershipRole: 'ADMIN' },
              { id: 't2', name: 'Tenant 2', slug: 't2', tenantStatus: 'ACTIVE', membershipRole: 'DEVELOPER' },
            ]),
          )
        }
        if (url.includes('/auth/me')) {
          return Promise.resolve(
            jsonResponse({ user: AUTH_USER, context: 'TENANT_SELECTION', tenant: null, membership: null, platform: { roles: [] } }),
          )
        }
        return Promise.reject(new Error(`fetch inesperado: ${url}`))
      }),
    )

    renderLoginPage()

    await user.type(screen.getByLabelText('E-mail'), 'ana@ykanban.dev')
    await user.type(screen.getByLabelText('Senha'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(screen.getByText('seleção de organização')).toBeInTheDocument())
  })

  it('faz login com 0 tenants + PLATFORM_ADMIN e navega para /platform', async () => {
    const user = userEvent.setup()
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
              user: { id: 'admin1', name: 'Admin HML', email: 'admin-hml@seudominio.com' },
              context: 'TENANT_SELECTION',
              tenant: null,
              membershipRole: null,
            }),
          )
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

    renderLoginPage()

    await user.type(screen.getByLabelText('E-mail'), 'admin-hml@seudominio.com')
    await user.type(screen.getByLabelText('Senha'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(screen.getByText('dashboard da plataforma')).toBeInTheDocument())
  })

  it('faz login com 0 tenants + sem PlatformAuthority e navega para /select-organization', async () => {
    const user = userEvent.setup()
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
              user: AUTH_USER,
              context: 'TENANT_SELECTION',
              tenant: null,
              membershipRole: null,
            }),
          )
        }
        if (url.includes('/auth/me')) {
          return Promise.resolve(
            jsonResponse({
              user: AUTH_USER,
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

    renderLoginPage()

    await user.type(screen.getByLabelText('E-mail'), 'ana@ykanban.dev')
    await user.type(screen.getByLabelText('Senha'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(screen.getByText('seleção de organização')).toBeInTheDocument())
  })

  it('mostra mensagem genérica quando as credenciais são inválidas', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(jsonResponse({ title: 'x', status: 401 }, 401))
        }
        if (url.includes('/auth/login')) {
          return Promise.resolve(jsonResponse({ title: 'E-mail ou senha inválidos.', status: 401 }, 401))
        }
        return Promise.reject(new Error(`fetch inesperado: ${url}`))
      }),
    )

    renderLoginPage()

    await user.type(screen.getByLabelText('E-mail'), 'ana@ykanban.dev')
    await user.type(screen.getByLabelText('Senha'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.')
    expect(screen.getByRole('button', { name: 'Entrar' })).not.toBeDisabled()
  })

  it('desabilita o botão de envio enquanto a requisição está pendente, evitando duplo submit', async () => {
    const user = userEvent.setup()
    let resolveLogin: (() => void) | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(jsonResponse({ title: 'x', status: 401 }, 401))
        }
        if (url.includes('/auth/login')) {
          return new Promise<Response>((resolve) => {
            resolveLogin = () =>
              resolve(
                jsonResponse({
                  accessToken: 't',
                  expiresIn: 900,
                  user: AUTH_USER,
                  context: 'TENANT_ACCESS',
                  tenant: TENANT,
                  membershipRole: 'DEVELOPER',
                }),
              )
          })
        }
        if (url.includes('/auth/me')) {
          return Promise.resolve(
            jsonResponse({
              user: AUTH_USER,
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

    renderLoginPage()

    await user.type(screen.getByLabelText('E-mail'), 'ana@ykanban.dev')
    await user.type(screen.getByLabelText('Senha'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(screen.getByRole('button', { name: 'Entrando…' })).toBeDisabled()

    resolveLogin?.()
    await waitFor(() => expect(screen.getByText('página de projetos')).toBeInTheDocument())
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PlatformTenantDetailPage } from '@/app/pages/PlatformTenantDetailPage/PlatformTenantDetailPage'
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

const DETAIL = {
  id: 't1',
  name: 'Acme',
  slug: 'acme',
  status: 'ACTIVE',
  memberCount: 3,
  projectCount: 2,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  admins: [{ id: 'u1', name: 'Ana Admin', email: 'ana@ykanban.dev' }],
  initialAdminInvitation: null,
}

const DETAIL_PENDING_INVITATION = {
  ...DETAIL,
  admins: [],
  initialAdminInvitation: {
    id: 'inv1',
    email: 'joao@empresa.dev',
    status: 'PENDING',
    createdAt: '2026-01-01T00:00:00Z',
    expiresAt: '2026-01-04T00:00:00Z',
    lastEmailSentAt: '2026-01-01T00:00:00Z',
  },
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/platform/tenants/t1']}>
        <Routes>
          <Route path="/platform/tenants/:tenantId" element={<PlatformTenantDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PlatformTenantDetailPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    authSession.setAccessToken(null)
  })

  it('mostra o detalhe da organização com contagens e admins', async () => {
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.endsWith('/platform/tenants/t1'), respond: () => jsonResponse(DETAIL) },
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('acme')).toBeInTheDocument())
    expect(screen.getByText('Ana Admin')).toBeInTheDocument()
    expect(screen.getByText('ana@ykanban.dev')).toBeInTheDocument()
  })

  it('renomeia a organização preservando o slug', async () => {
    const user = userEvent.setup()
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.endsWith('/platform/tenants/t1'), respond: () => jsonResponse(DETAIL) },
      {
        match: (url, method) => method === 'PATCH' && url.endsWith('/platform/tenants/t1'),
        respond: () => jsonResponse({ ...DETAIL, name: 'Acme Corp' }),
      },
    ])

    renderPage()
    await waitFor(() => expect(screen.getByRole('heading', { name: /Acme/ })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Renomear' }))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Acme Corp')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: /Acme Corp/ })).toBeInTheDocument())
    expect(screen.getByText('acme')).toBeInTheDocument()
  })

  it('suspende a organização após confirmação', async () => {
    const user = userEvent.setup()
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.endsWith('/platform/tenants/t1'), respond: () => jsonResponse(DETAIL) },
      {
        match: (url, method) => method === 'POST' && url.endsWith('/suspend'),
        respond: () => jsonResponse({ ...DETAIL, status: 'SUSPENDED' }),
      },
    ])

    renderPage()
    await waitFor(() => expect(screen.getByText('Ativa')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Suspender organização' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Suspender' }))

    await waitFor(() => expect(screen.getByText('Suspensa')).toBeInTheDocument())
  })

  it('mostra o convite de administrador inicial pendente com ações', async () => {
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.endsWith('/platform/tenants/t1'), respond: () => jsonResponse(DETAIL_PENDING_INVITATION) },
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('joao@empresa.dev')).toBeInTheDocument())
    expect(screen.getByText('Convite pendente')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reenviar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trocar e-mail' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revogar' })).toBeInTheDocument()
  })

  it('reenvia o convite de administrador inicial', async () => {
    const user = userEvent.setup()
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.endsWith('/platform/tenants/t1'), respond: () => jsonResponse(DETAIL_PENDING_INVITATION) },
      {
        match: (url, method) => method === 'POST' && url.endsWith('/initial-admin-invitation/resend'),
        respond: () => jsonResponse({ ...DETAIL_PENDING_INVITATION, initialAdminInvitation: { ...DETAIL_PENDING_INVITATION.initialAdminInvitation, id: 'inv2' } }),
      },
    ])

    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reenviar' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Reenviar' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Reenviar' })).not.toBeDisabled())
  })

  it('troca o e-mail do administrador inicial', async () => {
    const user = userEvent.setup()
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.endsWith('/platform/tenants/t1'), respond: () => jsonResponse(DETAIL_PENDING_INVITATION) },
      {
        match: (url, method) => method === 'POST' && url.endsWith('/initial-admin-invitation/replace'),
        respond: () =>
          jsonResponse({
            ...DETAIL_PENDING_INVITATION,
            initialAdminInvitation: { ...DETAIL_PENDING_INVITATION.initialAdminInvitation, email: 'maria@empresa.dev' },
          }),
      },
    ])

    renderPage()
    await waitFor(() => expect(screen.getByText('joao@empresa.dev')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Trocar e-mail' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Novo e-mail do administrador'), 'maria@empresa.dev')
    await user.click(within(dialog).getByRole('button', { name: 'Trocar e enviar novo convite' }))

    await waitFor(() => expect(screen.getByText('maria@empresa.dev')).toBeInTheDocument())
  })

  it('revoga o convite de administrador inicial após confirmação', async () => {
    const user = userEvent.setup()
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.endsWith('/platform/tenants/t1'), respond: () => jsonResponse(DETAIL_PENDING_INVITATION) },
      {
        match: (url, method) => method === 'POST' && url.endsWith('/initial-admin-invitation/revoke'),
        respond: () =>
          jsonResponse({
            ...DETAIL_PENDING_INVITATION,
            initialAdminInvitation: { ...DETAIL_PENDING_INVITATION.initialAdminInvitation, status: 'REVOKED' },
          }),
      },
    ])

    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Revogar' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Revogar' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Revogar' }))

    await waitFor(() => expect(screen.getByText('Convite revogado')).toBeInTheDocument())
  })
})

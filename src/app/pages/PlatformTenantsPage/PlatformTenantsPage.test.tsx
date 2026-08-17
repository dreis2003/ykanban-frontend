import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { PlatformTenantsPage } from '@/app/pages/PlatformTenantsPage/PlatformTenantsPage'
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

const ACME_TENANT = {
  id: 't1',
  name: 'Acme',
  slug: 'acme',
  status: 'ACTIVE',
  memberCount: 3,
  projectCount: 2,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PlatformTenantsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PlatformTenantsPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    authSession.setAccessToken(null)
  })

  it('mostra a lista de organizações', async () => {
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.includes('/platform/tenants?'), respond: () => jsonResponse(pageOf([ACME_TENANT])) },
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('Acme')).toBeInTheDocument())
    expect(screen.getByText('acme')).toBeInTheDocument()
  })

  it('cria uma organização com sucesso', async () => {
    const user = userEvent.setup()
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.includes('/platform/tenants?'), respond: () => jsonResponse(pageOf([])) },
      {
        match: (url, method) => method === 'POST' && url.endsWith('/platform/tenants'),
        respond: () => jsonResponse({ ...ACME_TENANT, memberCount: 0, projectCount: 0 }, 201),
      },
    ])

    renderPage()
    await waitFor(() => expect(screen.getByText('Nenhuma organização encontrada')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Nova organização' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Nome'), 'Acme')
    await user.click(within(dialog).getByRole('button', { name: 'Criar organização' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('mostra erro de conflito ao criar organização com slug duplicado', async () => {
    const user = userEvent.setup()
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.includes('/platform/tenants?'), respond: () => jsonResponse(pageOf([ACME_TENANT])) },
      {
        match: (url, method) => method === 'POST' && url.endsWith('/platform/tenants'),
        respond: () => jsonResponse({ title: 'Conflito', status: 409, detail: 'Já existe uma organização com este slug.' }, 409),
      },
    ])

    renderPage()
    await waitFor(() => expect(screen.getByText('Acme')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Nova organização' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Nome'), 'Acme')
    await user.click(within(dialog).getByRole('button', { name: 'Criar organização' }))

    await waitFor(() => expect(within(dialog).getByText('Já existe uma organização com este slug.')).toBeInTheDocument())
  })

  it('suspende uma organização ativa após confirmação', async () => {
    const user = userEvent.setup()
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.includes('/platform/tenants?'), respond: () => jsonResponse(pageOf([ACME_TENANT])) },
      {
        match: (url, method) => method === 'POST' && url.endsWith('/suspend'),
        respond: () => jsonResponse({ ...ACME_TENANT, status: 'SUSPENDED', admins: [] }),
      },
    ])

    renderPage()
    await waitFor(() => expect(screen.getByText('Acme')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Suspender' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Suspender' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

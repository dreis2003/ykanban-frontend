import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { PlatformPlansPage } from '@/app/pages/PlatformPlansPage/PlatformPlansPage'
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

const PRO_PLAN = {
  id: 'p1',
  code: 'PROFESSIONAL',
  name: 'Professional',
  description: 'Plano intermediário',
  status: 'INACTIVE',
  displayOrder: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PlatformPlansPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PlatformPlansPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    authSession.setAccessToken(null)
  })

  it('mostra a lista de planos', async () => {
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.includes('/platform/plans?'), respond: () => jsonResponse(pageOf([PRO_PLAN])) },
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('Professional')).toBeInTheDocument())
    expect(screen.getByText('PROFESSIONAL')).toBeInTheDocument()
    expect(screen.getByText('Inativo')).toBeInTheDocument()
  })

  it('mostra estado vazio quando não há planos', async () => {
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.includes('/platform/plans?'), respond: () => jsonResponse(pageOf([])) },
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('Nenhum plano encontrado')).toBeInTheDocument())
  })

  it('cria um plano com sucesso', async () => {
    const user = userEvent.setup()
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.includes('/platform/plans?'), respond: () => jsonResponse(pageOf([])) },
      {
        match: (url, method) => method === 'POST' && url.endsWith('/platform/plans'),
        respond: () => jsonResponse(PRO_PLAN, 201),
      },
    ])

    renderPage()
    await waitFor(() => expect(screen.getByText('Nenhum plano encontrado')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Novo plano' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Nome do plano'), 'Professional')
    await user.type(within(dialog).getByLabelText('Código'), 'PROFESSIONAL')
    await user.click(within(dialog).getByRole('button', { name: 'Criar plano' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('mostra erro de conflito ao criar plano com código duplicado', async () => {
    const user = userEvent.setup()
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.includes('/platform/plans?'), respond: () => jsonResponse(pageOf([PRO_PLAN])) },
      {
        match: (url, method) => method === 'POST' && url.endsWith('/platform/plans'),
        respond: () => jsonResponse({ title: 'Conflito', status: 409, detail: 'Já existe um plano com este código.' }, 409),
      },
    ])

    renderPage()
    await waitFor(() => expect(screen.getByText('Professional')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Novo plano' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Nome do plano'), 'Professional')
    await user.type(within(dialog).getByLabelText('Código'), 'PROFESSIONAL')
    await user.click(within(dialog).getByRole('button', { name: 'Criar plano' }))

    await waitFor(() => expect(within(dialog).getByText('Já existe um plano com este código.')).toBeInTheDocument())
  })

  it('filtra por status', async () => {
    mockFetchRouter([
      {
        match: (url, method) => method === 'GET' && url.includes('/platform/plans?') && url.includes('status=ACTIVE'),
        respond: () => jsonResponse(pageOf([])),
      },
      {
        match: (url, method) => method === 'GET' && url.includes('/platform/plans?') && !url.includes('status='),
        respond: () => jsonResponse(pageOf([PRO_PLAN])),
      },
    ])
    const user = userEvent.setup()

    renderPage()
    await waitFor(() => expect(screen.getByText('Professional')).toBeInTheDocument())

    await user.click(screen.getByRole('tab', { name: 'Ativos' }))

    await waitFor(() => expect(screen.getByText('Nenhum plano encontrado')).toBeInTheDocument())
  })
})

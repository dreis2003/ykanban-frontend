import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { PlatformDashboardPage } from '@/app/pages/PlatformDashboardPage/PlatformDashboardPage'
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

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PlatformDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PlatformDashboardPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    authSession.setAccessToken(null)
  })

  it('mostra as métricas agregadas da plataforma', async () => {
    mockFetchRouter([
      {
        match: (url, method) => method === 'GET' && url.includes('/platform/dashboard'),
        respond: () =>
          jsonResponse({ totalTenants: 12, activeTenants: 10, suspendedTenants: 2, uniqueUsers: 42, totalProjects: 30 }),
      },
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument())
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('mostra erro quando a chamada falha', async () => {
    mockFetchRouter([
      {
        match: (url, method) => method === 'GET' && url.includes('/platform/dashboard'),
        respond: () => jsonResponse({ title: 'Erro', status: 500 }, 500),
      },
    ])

    renderPage()

    await waitFor(() =>
      expect(screen.getByText('Não foi possível carregar as métricas da plataforma.')).toBeInTheDocument(),
    )
  })
})

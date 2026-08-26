import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { TenantIntegrationsPage } from './TenantIntegrationsPage'

interface FetchHandler {
  match: (url: string, method: string) => boolean
  respond: (init?: RequestInit) => Response | Promise<Response>
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
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
      return Promise.resolve(handler.respond(init))
    }),
  )
}

describe('TenantIntegrationsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function renderPage() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TenantIntegrationsPage />
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it('renders integration form with trusted read-only base URL', async () => {
    mockFetchRouter([
      {
        match: (url, method) => url.includes('/tenants/current/integrations/ycommunication') && method === 'GET',
        respond: () =>
          jsonResponse({
            configured: true,
            id: 'int-1',
            baseUrl: 'http://localhost:8080',
            maskedApiKey: 'ycom_***',
            active: true,
            updatedAt: '2026-08-25T20:00:00Z',
          }),
      },
    ])

    renderPage()

    const urlInput = await screen.findByDisplayValue('http://localhost:8080')
    expect(urlInput).toBeInTheDocument()
    expect(urlInput).toHaveAttribute('readOnly')
    expect(urlInput).toBeDisabled()
    expect(screen.getByText('YCommunication Hub')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Salvar Configurações/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Testar Conexão/i })).toBeInTheDocument()
  })

  it('tests connection and displays application info upon success', async () => {
    const user = userEvent.setup()

    mockFetchRouter([
      {
        match: (url, method) => url.includes('/tenants/current/integrations/ycommunication') && method === 'GET',
        respond: () =>
          jsonResponse({
            configured: true,
            id: 'int-1',
            baseUrl: 'http://localhost:8080',
            maskedApiKey: 'ycom_***',
            active: true,
          }),
      },
      {
        match: (url, method) => url.includes('/tenants/current/integrations/ycommunication/test') && method === 'POST',
        respond: () =>
          jsonResponse({
            success: true,
            applicationName: 'YKanban Core',
            companyName: 'Yakuza Studio',
            scopes: ['MESSAGES_SEND', 'MESSAGES_READ'],
          }),
      },
    ])

    renderPage()

    const testBtn = await screen.findByRole('button', { name: /Testar Conexão/i })
    await user.click(testBtn)

    expect(await screen.findByTestId('test-connection-success')).toBeInTheDocument()
    expect(screen.getByText(/YKanban Core/)).toBeInTheDocument()
    expect(screen.getByText(/Yakuza Studio/)).toBeInTheDocument()
    expect(screen.getByText(/MESSAGES_SEND, MESSAGES_READ/)).toBeInTheDocument()
  })

  it('saves integration changes with write-only key without exposing baseUrl to tenant payload', async () => {
    const user = userEvent.setup()

    let savedPayload: unknown = null

    mockFetchRouter([
      {
        match: (url, method) => url.includes('/tenants/current/integrations/ycommunication') && method === 'GET',
        respond: () => jsonResponse({ configured: false, active: false, baseUrl: 'http://localhost:8080' }),
      },
      {
        match: (url, method) => url.includes('/tenants/current/integrations/ycommunication') && method === 'PUT',
        respond: (init) => {
          savedPayload = JSON.parse(init?.body as string)
          return jsonResponse({
            configured: true,
            id: 'int-2',
            baseUrl: 'http://localhost:8080',
            maskedApiKey: 'ycom_***',
            active: true,
          })
        },
      },
    ])

    renderPage()

    const keyInput = await screen.findByLabelText(/API Key/i)
    await user.type(keyInput, 'ycom_secret_new_key_123')

    const saveBtn = screen.getByRole('button', { name: /Salvar Configurações/i })
    await user.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByTestId('save-success-banner')).toBeInTheDocument()
    })

    expect(savedPayload).toEqual({
      apiKey: 'ycom_secret_new_key_123',
      active: true,
    })
    expect(keyInput).toHaveValue('')
  })
})

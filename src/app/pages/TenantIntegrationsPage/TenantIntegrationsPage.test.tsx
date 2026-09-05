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

/** Prompt 33.1: quando a integração está configurada, esta página também consulta o catálogo de
 * canais e as preferências padrão — nenhum dos testes abaixo verifica essa seção, então os dois
 * fallbacks respondem com lista vazia por padrão, sempre por ÚLTIMO (`find` usa o primeiro match)
 * para que um teste que precise verificar esses endpoints possa continuar passando seu próprio
 * handler explícito antes deles. */
function mockFetchRouter(handlers: FetchHandler[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString()
      const method = (init?.method ?? 'GET').toUpperCase()
      const allHandlers = [
        ...handlers,
        { match: (u: string, m: string) => u.includes('/channel-preferences') && m === 'GET', respond: () => jsonResponse([]) },
        { match: (u: string, m: string) => u.includes('/integrations/ycommunication/channels') && m === 'GET', respond: () => jsonResponse([]) },
      ]
      const handler = allHandlers.find((h) => h.match(url, method))
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
        match: (url, method) => url.includes('/delivery-receipts') && method === 'GET',
        respond: () =>
          jsonResponse({
            configured: false,
            signingSecretConfigured: false,
          }),
      },
      {
        match: (url, method) => url.includes('/tenants/current/integrations/ycommunication') &&
          !url.includes('/channel-preferences') &&
          !url.includes('/integrations/ycommunication/channels') &&
          method === 'GET',
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
        match: (url, method) => url.includes('/delivery-receipts') && method === 'GET',
        respond: () =>
          jsonResponse({
            configured: false,
            signingSecretConfigured: false,
          }),
      },
      {
        match: (url, method) => url.includes('/tenants/current/integrations/ycommunication') &&
          !url.includes('/channel-preferences') &&
          !url.includes('/integrations/ycommunication/channels') &&
          method === 'GET',
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
        match: (url, method) => url.includes('/tenants/current/integrations/ycommunication') &&
          !url.includes('/channel-preferences') &&
          !url.includes('/integrations/ycommunication/channels') &&
          method === 'GET',
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

  describe('Delivery Receipts', () => {
    it('prompts to configure the API Key first when the integration is not configured yet', async () => {
      mockFetchRouter([
        {
          match: (url, method) => url.includes('/tenants/current/integrations/ycommunication') &&
          !url.includes('/channel-preferences') &&
          !url.includes('/integrations/ycommunication/channels') &&
          method === 'GET',
          respond: () => jsonResponse({ configured: false, active: false, baseUrl: 'http://localhost:8080' }),
        },
      ])

      renderPage()

      expect(await screen.findByTestId('delivery-receipts-card')).toBeInTheDocument()
      expect(screen.getByText(/Configure a API Key do YCommunication acima primeiro/i)).toBeInTheDocument()
      expect(screen.queryByLabelText(/Colar Signing Secret/i)).not.toBeInTheDocument()
    })

    it('shows the read-only callback URL, supported statuses and configured secret status', async () => {
      mockFetchRouter([
        {
          match: (url, method) => url.includes('/delivery-receipts') && method === 'GET',
          respond: () =>
            jsonResponse({
              configured: true,
              callbackPublicId: 'cb-public-1',
              callbackUrl: 'https://ykanban.example.com/api/v1/provider-callbacks/ycommunication/cb-public-1',
              signingSecretConfigured: true,
              secretRotatedAt: '2026-08-26T12:00:00Z',
            }),
        },
        {
          match: (url, method) => url.includes('/tenants/current/integrations/ycommunication') &&
          !url.includes('/channel-preferences') &&
          !url.includes('/integrations/ycommunication/channels') &&
          method === 'GET',
          respond: () =>
            jsonResponse({ configured: true, id: 'int-1', baseUrl: 'http://localhost:8080', active: true }),
        },
      ])

      renderPage()

      const callbackInput = await screen.findByDisplayValue(
        'https://ykanban.example.com/api/v1/provider-callbacks/ycommunication/cb-public-1'
      )
      expect(callbackInput).toHaveAttribute('readOnly')
      expect(callbackInput).toBeDisabled()

      for (const status of ['SENT', 'DELIVERED', 'READ', 'FAILED', 'DEAD_LETTER']) {
        expect(screen.getByText(status)).toBeInTheDocument()
      }

      expect(screen.getByTestId('signing-secret-status')).toHaveTextContent('Configurado')
    })

    it('copies the callback URL to the clipboard', async () => {
      const user = userEvent.setup()
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      })

      mockFetchRouter([
        {
          match: (url, method) => url.includes('/delivery-receipts') && method === 'GET',
          respond: () =>
            jsonResponse({
              configured: true,
              callbackUrl: 'https://ykanban.example.com/api/v1/provider-callbacks/ycommunication/cb-public-1',
              signingSecretConfigured: false,
            }),
        },
        {
          match: (url, method) => url.includes('/tenants/current/integrations/ycommunication') &&
          !url.includes('/channel-preferences') &&
          !url.includes('/integrations/ycommunication/channels') &&
          method === 'GET',
          respond: () =>
            jsonResponse({ configured: true, id: 'int-1', baseUrl: 'http://localhost:8080', active: true }),
        },
      ])

      renderPage()

      const copyBtn = await screen.findByRole('button', { name: /Copiar/i })
      await user.click(copyBtn)

      expect(writeText).toHaveBeenCalledWith(
        'https://ykanban.example.com/api/v1/provider-callbacks/ycommunication/cb-public-1'
      )
      expect(await screen.findByRole('button', { name: /Copiado!/i })).toBeInTheDocument()
    })

    it('disables the submit button until the pasted secret meets the minimum length', async () => {
      const user = userEvent.setup()

      mockFetchRouter([
        {
          match: (url, method) => url.includes('/delivery-receipts') && method === 'GET',
          respond: () => jsonResponse({ configured: true, signingSecretConfigured: false }),
        },
        {
          match: (url, method) => url.includes('/tenants/current/integrations/ycommunication') &&
          !url.includes('/channel-preferences') &&
          !url.includes('/integrations/ycommunication/channels') &&
          method === 'GET',
          respond: () =>
            jsonResponse({ configured: true, id: 'int-1', baseUrl: 'http://localhost:8080', active: true }),
        },
      ])

      renderPage()

      const secretInput = await screen.findByLabelText(/Colar Signing Secret/i)
      const saveBtn = screen.getByRole('button', { name: /Salvar Signing Secret/i })
      expect(saveBtn).toBeDisabled()

      await user.type(secretInput, 'too-short')
      expect(saveBtn).toBeDisabled()

      await user.type(secretInput, '-now-long-enough-value')
      expect(saveBtn).not.toBeDisabled()
    })

    it('saves a pasted signing secret and clears the field on success', async () => {
      const user = userEvent.setup()
      let savedPayload: unknown = null

      mockFetchRouter([
        {
          match: (url, method) => url.includes('/delivery-receipts/signing-secret') && method === 'PUT',
          respond: (init) => {
            savedPayload = JSON.parse(init?.body as string)
            return jsonResponse({
              configured: true,
              callbackUrl: 'https://ykanban.example.com/api/v1/provider-callbacks/ycommunication/cb-public-1',
              signingSecretConfigured: true,
              secretRotatedAt: '2026-08-27T08:00:00Z',
            })
          },
        },
        {
          match: (url, method) => url.includes('/delivery-receipts') && method === 'GET',
          respond: () => jsonResponse({ configured: true, signingSecretConfigured: false }),
        },
        {
          match: (url, method) => url.includes('/tenants/current/integrations/ycommunication') &&
          !url.includes('/channel-preferences') &&
          !url.includes('/integrations/ycommunication/channels') &&
          method === 'GET',
          respond: () =>
            jsonResponse({ configured: true, id: 'int-1', baseUrl: 'http://localhost:8080', active: true }),
        },
      ])

      renderPage()

      const secretInput = await screen.findByLabelText(/Colar Signing Secret/i)
      await user.type(secretInput, 'pasted-signing-secret-from-ycommunication')

      const saveBtn = screen.getByRole('button', { name: /Salvar Signing Secret/i })
      await user.click(saveBtn)

      await waitFor(() => {
        expect(screen.getByTestId('signing-secret-save-success-banner')).toBeInTheDocument()
      })

      expect(savedPayload).toEqual({ signingSecret: 'pasted-signing-secret-from-ycommunication' })
      expect(secretInput).toHaveValue('')
    })

    it('shows an error message when saving the signing secret fails', async () => {
      const user = userEvent.setup()

      mockFetchRouter([
        {
          match: (url, method) => url.includes('/delivery-receipts/signing-secret') && method === 'PUT',
          respond: () =>
            jsonResponse({ title: 'Configure a API Key do YCommunication antes.' }, 400),
        },
        {
          match: (url, method) => url.includes('/delivery-receipts') && method === 'GET',
          respond: () => jsonResponse({ configured: true, signingSecretConfigured: false }),
        },
        {
          match: (url, method) => url.includes('/tenants/current/integrations/ycommunication') &&
          !url.includes('/channel-preferences') &&
          !url.includes('/integrations/ycommunication/channels') &&
          method === 'GET',
          respond: () =>
            jsonResponse({ configured: true, id: 'int-1', baseUrl: 'http://localhost:8080', active: true }),
        },
      ])

      renderPage()

      const secretInput = await screen.findByLabelText(/Colar Signing Secret/i)
      await user.type(secretInput, 'a-perfectly-valid-length-secret-value')

      const saveBtn = screen.getByRole('button', { name: /Salvar Signing Secret/i })
      await user.click(saveBtn)

      expect(await screen.findByTestId('signing-secret-save-error')).toBeInTheDocument()
    })
  })

  describe('Canais Padrão', () => {
    function integrationHandler() {
      return {
        match: (url: string, method: string) =>
          url.includes('/tenants/current/integrations/ycommunication') &&
          !url.includes('/channel-preferences') &&
          !url.includes('/integrations/ycommunication/channels') &&
          method === 'GET',
        respond: () => jsonResponse({ configured: true, id: 'int-1', baseUrl: 'http://localhost:8080', maskedApiKey: 'ycom_***', active: true }),
      }
    }

    function deliveryReceiptsHandler() {
      return {
        match: (url: string, method: string) => url.includes('/delivery-receipts') && method === 'GET',
        respond: () => jsonResponse({ configured: false, signingSecretConfigured: false }),
      }
    }

    function catalogHandler(items: unknown[]) {
      return {
        match: (url: string, method: string) => url.includes('/integrations/ycommunication/channels') && method === 'GET',
        respond: () => jsonResponse(items),
      }
    }

    function preferencesHandler(items: unknown[]) {
      return {
        match: (url: string, method: string) => url.includes('/channel-preferences') && method === 'GET',
        respond: () => jsonResponse(items),
      }
    }

    const CATALOG = [
      { id: 'chan-gmail', channelType: 'EMAIL', name: 'Gmail', displayName: 'Gmail Corporativo', active: true },
      { id: 'chan-brevo', channelType: 'EMAIL', name: 'Brevo', displayName: 'Brevo Sistema', active: true },
    ]

    it('lists all four channel types with their current default and availability', async () => {
      mockFetchRouter([
        integrationHandler(),
        deliveryReceiptsHandler(),
        catalogHandler(CATALOG),
        preferencesHandler([
          { channelType: 'EMAIL', channel: { id: 'chan-gmail', displayName: 'Gmail Corporativo', availability: 'AVAILABLE' }, availability: 'AVAILABLE' },
          { channelType: 'TELEGRAM', channel: null, availability: 'UNCONFIGURED' },
          { channelType: 'WHATSAPP', channel: null, availability: 'UNCONFIGURED' },
          { channelType: 'WEBHOOK', channel: null, availability: 'UNCONFIGURED' },
        ]),
      ])

      renderPage()

      const list = await screen.findByTestId('tenant-channels-list')
      expect(list).toBeInTheDocument()
      expect(await screen.findByText(/Gmail Corporativo — Ativo/)).toBeInTheDocument()
      expect(screen.getAllByText('Nenhum canal configurado')).toHaveLength(3)
    })

    it('selecting a channel from the dropdown saves it as the tenant default', async () => {
      const user = userEvent.setup()
      let savedPayload: unknown = null

      mockFetchRouter([
        integrationHandler(),
        deliveryReceiptsHandler(),
        catalogHandler(CATALOG),
        preferencesHandler([{ channelType: 'EMAIL', channel: null, availability: 'UNCONFIGURED' }]),
        {
          match: (url, method) => url.includes('/channel-preferences/EMAIL') && method === 'PUT',
          respond: (init) => {
            savedPayload = JSON.parse(init?.body as string)
            return jsonResponse({
              channelType: 'EMAIL',
              channel: { id: 'chan-brevo', displayName: 'Brevo Sistema', availability: 'AVAILABLE' },
              availability: 'AVAILABLE',
            })
          },
        },
      ])

      renderPage()

      const select = await screen.findByLabelText('Canal padrão de E-mail')
      await user.selectOptions(select, 'chan-brevo')

      await waitFor(() => expect(savedPayload).toEqual({ channelConfigurationId: 'chan-brevo' }))
    })
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProjectNotificationsPage } from './ProjectNotificationsPage'
import { AuthContext, type AuthContextValue } from '@/features/auth/AuthContext'

interface FetchHandler {
  match: (url: string, method: string) => boolean
  respond: (init?: RequestInit) => Response | Promise<Response>
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

/** Prompt 33.1: toda renderização desta página agora também consulta canais de comunicação
 * (catálogo + preferências do Project) — nenhum dos testes abaixo verifica essa seção, então os
 * dois fallbacks abaixo respondem com lista vazia por padrão. Ficam sempre por ÚLTIMO na lista de
 * handlers (`find` usa o primeiro match) para que um teste que precise verificar esses endpoints
 * possa continuar passando seu próprio handler explícito antes deles. */
function mockFetchRouter(handlers: FetchHandler[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString()
      const method = (init?.method ?? 'GET').toUpperCase()
      const allHandlers = [...handlers, projectChannelsHandler([]), channelCatalogHandler([])]
      const handler = allHandlers.find((h) => h.match(url, method))
      if (!handler) {
        return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
      }
      return Promise.resolve(handler.respond(init))
    }),
  )
}

function projectChannelsHandler(items: unknown[]): FetchHandler {
  return {
    match: (url, method) => url.includes('/communication-channels') && method === 'GET',
    respond: () => jsonResponse(items),
  }
}

function channelCatalogHandler(items: unknown[]): FetchHandler {
  return {
    match: (url, method) => url.includes('/integrations/ycommunication/channels') && method === 'GET',
    respond: () => jsonResponse(items),
  }
}

const PROJECT_RESPONSE = { id: 'proj-1', code: 'YK', name: 'YKanban Core', status: 'ACTIVE' }

function destinationsHandler(items: unknown[] = []): FetchHandler {
  return {
    match: (url, method) => url.includes('/notification-destinations') && method === 'GET',
    respond: () => jsonResponse(items),
  }
}

function projectHandler(): FetchHandler {
  return {
    match: (url, method) =>
      url.includes('/projects/proj-1') &&
      !url.includes('/notifications') &&
      !url.includes('/communication-channels') &&
      method === 'GET',
    respond: () => jsonResponse(PROJECT_RESPONSE),
  }
}

function notificationsListHandler(items: unknown[] = []): FetchHandler {
  return {
    match: (url, method) => /\/projects\/proj-1\/notifications(\?.*)?$/.test(url) && method === 'GET',
    respond: () => jsonResponse(pageOf(items)),
  }
}

function notificationDetailHandler(id: string, detail: unknown): FetchHandler {
  return {
    match: (url, method) => url.includes(`/notifications/${id}`) && method === 'GET',
    respond: () => jsonResponse(detail),
  }
}

function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: { id: 'u1', name: 'Ana Admin', email: 'ana@ykanban.dev' },
    activeTenant: { id: 't1', name: 'Yakuza Studio', slug: 'yakuza-studio', status: 'ACTIVE' },
    membershipRole: 'ADMIN',
    membershipStatus: 'ACTIVE',
    authenticationContext: 'TENANT_ACCESS',
    platformRoles: [],
    availableTenants: [],
    isAuthenticated: true,
    isTenantSelected: true,
    isLoading: false,
    login: async () => undefined,
    selectTenant: async () => undefined,
    logout: async () => undefined,
    refreshAvailableTenants: async () => undefined,
    refreshSession: async () => 'TENANT_ACCESS',
    completeInvitationRegistration: async () => undefined,
    completeInvitationAcceptance: async () => undefined,
    ...overrides,
  }
}

function renderPage(projectId = 'proj-1', auth: AuthContextValue = authValue()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={auth}>
          <MemoryRouter initialEntries={[`/projects/${projectId}/notifications`]}>
            <Routes>
              <Route path="/projects/:projectId/notifications" element={<ProjectNotificationsPage />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    ),
  }
}

const NOTIFICATION_SENT = {
  id: 'notif-1',
  eventType: 'CARD_COMPLETED',
  channel: 'TELEGRAM',
  dispatchStatus: 'DISPATCHED',
  remoteStatus: 'DELIVERED',
  createdAt: '2026-08-27T14:32:00Z',
  dispatchedAt: '2026-08-27T14:32:01Z',
  remoteStatusUpdatedAt: '2026-08-27T14:32:02Z',
}

describe('ProjectNotificationsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders project header and destination list', async () => {
    mockFetchRouter([
      destinationsHandler([
        {
          id: 'dest-1',
          projectId: 'proj-1',
          channel: 'TELEGRAM',
          recipientPayload: '{"chatId":"-100123456"}',
          events: ['CARD_CREATED', 'CARD_COMPLETED'],
          active: true,
          updatedAt: '2026-08-25T20:00:00Z',
        },
      ]),
      projectHandler(),
      notificationsListHandler([]),
    ])

    renderPage()

    expect(await screen.findByRole('heading', { name: 'YKanban Core' })).toBeInTheDocument()
    expect(await screen.findByText('-100123456')).toBeInTheDocument()
    const destinationsList = screen.getByTestId('destinations-list')
    expect(within(destinationsList).getByText('TELEGRAM')).toBeInTheDocument()
    expect(within(destinationsList).getByText('Criação de Card')).toBeInTheDocument()
    expect(within(destinationsList).getByText('Conclusão em Produção')).toBeInTheDocument()
  })

  it('creates a new notification destination via modal', async () => {
    const user = userEvent.setup()
    let createdPayload: unknown = null

    mockFetchRouter([
      destinationsHandler([]),
      {
        match: (url, method) => url.includes('/notification-destinations') && method === 'POST',
        respond: (init) => {
          createdPayload = JSON.parse(init?.body as string)
          return jsonResponse({
            id: 'dest-2',
            projectId: 'proj-1',
            channel: 'EMAIL',
            recipientPayload: '{"to":["team@ykanban.dev"]}',
            events: ['CARD_CREATED', 'CARD_MOVED', 'CARD_COMPLETED'],
            active: true,
          })
        },
      },
      projectHandler(),
      notificationsListHandler([]),
    ])

    renderPage()

    const addBtn = await screen.findByRole('button', { name: /Adicionar Destino/i })
    await user.click(addBtn)

    expect(screen.getByText('Novo Destino de Notificação')).toBeInTheDocument()
    const input = screen.getByLabelText(/Endereço de E-mail/i)
    await user.type(input, 'team@ykanban.dev')

    const saveBtn = screen.getByRole('button', { name: /Salvar Destino/i })
    await user.click(saveBtn)

    await waitFor(() => {
      expect(createdPayload).toEqual({
        channel: 'EMAIL',
        recipientPayload: JSON.stringify({ to: ['team@ykanban.dev'] }),
        events: ['CARD_CREATED', 'CARD_MOVED', 'CARD_COMPLETED'],
        active: true,
      })
    })
  })

  // Reproduz o bug real reportado: o modal ficava "sem fazer nada" numa falha (400 de payload
  // inválido) porque nada renderizava createMutation.error - a requisição de fato saía e o
  // backend de fato respondia, só que o usuário nunca via isso.
  it('shows the backend error message instead of silently doing nothing when creation fails', async () => {
    const user = userEvent.setup()

    mockFetchRouter([
      destinationsHandler([]),
      {
        match: (url, method) => url.includes('/notification-destinations') && method === 'POST',
        respond: () =>
          jsonResponse(
            {
              type: 'about:blank',
              title: 'Destino de notificação inválido',
              status: 400,
              detail: 'Destino de notificação inválido para o canal selecionado.',
              errors: ['recipient.to: deve ser uma lista não vazia de e-mails'],
            },
            400,
          ),
      },
      projectHandler(),
      notificationsListHandler([]),
    ])

    renderPage()

    const addBtn = await screen.findByRole('button', { name: /Adicionar Destino/i })
    await user.click(addBtn)

    const input = screen.getByLabelText(/Endereço de E-mail/i)
    await user.type(input, 'invalido')

    const saveBtn = screen.getByRole('button', { name: /Salvar Destino/i })
    await user.click(saveBtn)

    expect(await screen.findByTestId('create-destination-error')).toHaveTextContent(
      'Destino de notificação inválido para o canal selecionado.',
    )
    // O modal nunca fecha silenciosamente numa falha - o usuário continua vendo o formulário e o erro.
    expect(screen.getByText('Novo Destino de Notificação')).toBeInTheDocument()
  })

  describe('notification delivery history', () => {
    it('shows a loading state while fetching notifications', async () => {
      // Resolução manual (sem timing implícito): controla exatamente quando a resposta de
      // notificações chega, para observar deterministicamente o estado de loading da seção.
      let resolveNotifications: (response: Response) => void = () => {}
      const notificationsPromise = new Promise<Response>((resolve) => {
        resolveNotifications = resolve
      })

      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        {
          match: (url, method) => /\/projects\/proj-1\/notifications(\?.*)?$/.test(url) && method === 'GET',
          respond: () => notificationsPromise,
        },
      ])

      renderPage()

      await screen.findByRole('heading', { name: 'YKanban Core' })
      expect(screen.getByText('Carregando notificações enviadas...')).toBeInTheDocument()

      resolveNotifications(jsonResponse(pageOf([])))

      await waitFor(() => {
        expect(screen.getByText('Nenhuma notificação enviada para este projeto.')).toBeInTheDocument()
      })
    })

    it('shows the empty state when there are no notifications', async () => {
      mockFetchRouter([destinationsHandler([]), projectHandler(), notificationsListHandler([])])

      renderPage()

      expect(await screen.findByText('Nenhuma notificação enviada para este projeto.')).toBeInTheDocument()
    })

    it('shows an error state without leaking stale data on API failure', async () => {
      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        {
          match: (url, method) => /\/notifications(\?.*)?$/.test(url) && method === 'GET',
          respond: () => jsonResponse({ title: 'Erro interno', status: 500 }, 500),
        },
      ])

      renderPage()

      expect(await screen.findByText('Falha ao carregar notificações enviadas.')).toBeInTheDocument()
      expect(screen.queryByTestId('notifications-table')).not.toBeInTheDocument()
    })

    it('renders the list with distinct dispatch and remote status labels, including a diverging case', async () => {
      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([
          NOTIFICATION_SENT,
          {
            ...NOTIFICATION_SENT,
            id: 'notif-2',
            dispatchStatus: 'DISPATCHED',
            remoteStatus: 'FAILED',
          },
        ]),
      ])

      renderPage()

      const table = await screen.findByTestId('notifications-table')
      expect(within(table).getAllByText('Aceito pelo YCommunication')).toHaveLength(2)
      expect(within(table).getByText('Entregue')).toBeInTheDocument()
      expect(within(table).getByText('Falhou')).toBeInTheDocument()
    })

    it('shows "Aguardando atualização" (never "Falhou") when remoteStatus is null', async () => {
      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([{ ...NOTIFICATION_SENT, id: 'notif-3', remoteStatus: null, remoteStatusUpdatedAt: null }]),
      ])

      renderPage()

      const table = await screen.findByTestId('notifications-table')
      expect(within(table).getByText('Aguardando atualização')).toBeInTheDocument()
    })

    it('falls back to the raw value for an unknown status without breaking the UI', async () => {
      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([{ ...NOTIFICATION_SENT, id: 'notif-4', remoteStatus: 'UNKNOWN_NEW_STATUS' }]),
      ])

      renderPage()

      const table = await screen.findByTestId('notifications-table')
      expect(within(table).getByText('UNKNOWN_NEW_STATUS')).toBeInTheDocument()
    })

    it('opens a detail drawer with history timeline showing a redrive lifecycle', async () => {
      const user = userEvent.setup()
      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([NOTIFICATION_SENT]),
        notificationDetailHandler('notif-1', {
          ...NOTIFICATION_SENT,
          ycommunicationMessageId: 'msg-abc-123',
          lastError: null,
          history: [
            { status: 'DEAD_LETTER', occurredAt: '2026-08-27T14:32:00Z' },
            { status: 'SENT', occurredAt: '2026-08-27T15:10:00Z' },
            { status: 'DELIVERED', occurredAt: '2026-08-27T15:11:00Z' },
          ],
        }),
      ])

      renderPage()

      const row = await screen.findByTestId('notification-row-notif-1')
      await user.click(row)

      const drawer = await screen.findByRole('dialog', { name: 'Detalhe da notificação' })
      expect(within(drawer).getByText('msg-abc-123')).toBeInTheDocument()

      const timeline = within(drawer).getByTestId('notification-history-timeline')
      const entries = within(timeline).getAllByRole('listitem')
      expect(entries).toHaveLength(3)
      expect(entries[0]).toHaveTextContent('Dead Letter')
      expect(entries[1]).toHaveTextContent('Enviado')
      expect(entries[2]).toHaveTextContent('Entregue')
    })

    it('copies the YCommunication message ID to the clipboard', async () => {
      const user = userEvent.setup()
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      })

      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([NOTIFICATION_SENT]),
        notificationDetailHandler('notif-1', {
          ...NOTIFICATION_SENT,
          ycommunicationMessageId: 'msg-abc-123',
          lastError: null,
          history: [{ status: 'DELIVERED', occurredAt: '2026-08-27T14:32:02Z' }],
        }),
      ])

      renderPage()

      const row = await screen.findByTestId('notification-row-notif-1')
      await user.click(row)

      const copyBtn = await screen.findByRole('button', { name: 'Copiar ID' })
      await user.click(copyBtn)

      expect(writeText).toHaveBeenCalledWith('msg-abc-123')
    })

    it('closes the drawer and does not leak data when the active tenant changes', async () => {
      const user = userEvent.setup()
      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([NOTIFICATION_SENT]),
        notificationDetailHandler('notif-1', {
          ...NOTIFICATION_SENT,
          ycommunicationMessageId: 'msg-abc-123',
          lastError: null,
          history: [{ status: 'DELIVERED', occurredAt: '2026-08-27T14:32:02Z' }],
        }),
      ])

      const { rerender, queryClient } = renderPage('proj-1', authValue())

      const row = await screen.findByTestId('notification-row-notif-1')
      await user.click(row)
      expect(await screen.findByRole('dialog', { name: 'Detalhe da notificação' })).toBeInTheDocument()

      const otherTenantAuth = authValue({ activeTenant: { id: 't2', name: 'Outra Empresa', slug: 'outra', status: 'ACTIVE' } })
      rerender(
        <QueryClientProvider client={queryClient}>
          <AuthContext.Provider value={otherTenantAuth}>
            <MemoryRouter initialEntries={['/projects/proj-1/notifications']}>
              <Routes>
                <Route path="/projects/:projectId/notifications" element={<ProjectNotificationsPage />} />
              </Routes>
            </MemoryRouter>
          </AuthContext.Provider>
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Detalhe da notificação' })).not.toBeInTheDocument()
      })
    })
  })

  describe('Canais do Projeto', () => {
    const CATALOG = [
      { id: 'chan-gmail', channelType: 'EMAIL', name: 'Gmail', displayName: 'Gmail Corporativo', active: true },
      { id: 'chan-brevo', channelType: 'EMAIL', name: 'Brevo', displayName: 'Brevo Sistema', active: true },
    ]

    function projectChannelsHandlerWith(items: unknown[]): FetchHandler {
      return {
        match: (url, method) => url.includes('/communication-channels') && method === 'GET',
        respond: () => jsonResponse(items),
      }
    }

    function channelCatalogHandlerWith(items: unknown[]): FetchHandler {
      return {
        match: (url, method) => url.includes('/integrations/ycommunication/channels') && method === 'GET',
        respond: () => jsonResponse(items),
      }
    }

    const INHERIT_EMAIL_PREF = {
      channelType: 'EMAIL',
      mode: 'INHERIT',
      tenantDefault: { id: 'chan-gmail', displayName: 'Gmail Corporativo', availability: 'AVAILABLE' },
      projectOverride: null,
      effectiveChannel: { id: 'chan-gmail', displayName: 'Gmail Corporativo', availability: 'AVAILABLE' },
      effectiveSource: 'TENANT',
      availability: 'AVAILABLE',
    }

    it('shows the inherited tenant default and effective channel', async () => {
      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([]),
        projectChannelsHandlerWith([INHERIT_EMAIL_PREF]),
        channelCatalogHandlerWith(CATALOG),
      ])

      renderPage()

      expect(await screen.findByTestId('project-channel-EMAIL')).toBeInTheDocument()
      expect(screen.getAllByText('Gmail Corporativo').length).toBeGreaterThan(0)
      expect(screen.getByText(/Canal efetivo:/)).toHaveTextContent('Gmail Corporativo')
      expect(screen.getByText(/origem: padrão da empresa/)).toBeInTheDocument()
    })

    it('selecting "Usar outro canal" reveals a dropdown and saves an OVERRIDE on selection', async () => {
      const user = userEvent.setup()
      let savedPayload: unknown = null

      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([]),
        projectChannelsHandlerWith([INHERIT_EMAIL_PREF]),
        channelCatalogHandlerWith(CATALOG),
        {
          match: (url, method) => url.includes('/communication-channels/EMAIL') && method === 'PUT',
          respond: (init) => {
            savedPayload = JSON.parse(init?.body as string)
            return jsonResponse({
              channelType: 'EMAIL',
              mode: 'OVERRIDE',
              tenantDefault: INHERIT_EMAIL_PREF.tenantDefault,
              projectOverride: { id: 'chan-brevo', displayName: 'Brevo Sistema', availability: 'AVAILABLE' },
              effectiveChannel: { id: 'chan-brevo', displayName: 'Brevo Sistema', availability: 'AVAILABLE' },
              effectiveSource: 'PROJECT',
              availability: 'AVAILABLE',
            })
          },
        },
      ])

      renderPage()

      const card = await screen.findByTestId('project-channel-EMAIL')
      await user.click(within(card).getByLabelText('Usar outro canal'))

      const select = await within(card).findByLabelText('Canal específico de E-mail para este projeto')
      await user.selectOptions(select, 'chan-brevo')

      await waitFor(() => expect(savedPayload).toEqual({ mode: 'OVERRIDE', channelConfigurationId: 'chan-brevo' }))
    })

    it('selecting "Desabilitar" immediately disables the channel for this project', async () => {
      const user = userEvent.setup()
      let savedPayload: unknown = null
      // GET stateful o suficiente para refletir a invalidação de query disparada após o PUT —
      // sem isso o teste não conseguiria distinguir "mutação enviada" de "UI realmente atualizada".
      let currentPreference: Record<string, unknown> = INHERIT_EMAIL_PREF

      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([]),
        {
          match: (url, method) => url.includes('/communication-channels') && !url.includes('/EMAIL') && method === 'GET',
          respond: () => jsonResponse([currentPreference]),
        },
        channelCatalogHandlerWith(CATALOG),
        {
          match: (url, method) => url.includes('/communication-channels/EMAIL') && method === 'PUT',
          respond: (init) => {
            savedPayload = JSON.parse(init?.body as string)
            currentPreference = {
              channelType: 'EMAIL',
              mode: 'DISABLED',
              tenantDefault: INHERIT_EMAIL_PREF.tenantDefault,
              projectOverride: null,
              effectiveChannel: null,
              effectiveSource: 'DISABLED',
              availability: null,
            }
            return jsonResponse(currentPreference)
          },
        },
      ])

      renderPage()

      const card = await screen.findByTestId('project-channel-EMAIL')
      await user.click(within(card).getByLabelText(/Desabilitar e-mail neste projeto/i))

      await waitFor(() => expect(savedPayload).toEqual({ mode: 'DISABLED' }))
      expect(await within(card).findByText(/Nenhum \(desabilitado\)/)).toBeInTheDocument()
    })

    it('shows a warning when the effective channel is configured but unavailable — never falls back silently', async () => {
      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([]),
        projectChannelsHandlerWith([
          {
            channelType: 'EMAIL',
            mode: 'OVERRIDE',
            tenantDefault: { id: 'chan-gmail', displayName: 'Gmail Corporativo', availability: 'AVAILABLE' },
            projectOverride: { id: 'chan-removed', displayName: 'Gmail-X', availability: 'CONFIGURED_BUT_UNAVAILABLE' },
            effectiveChannel: { id: 'chan-removed', displayName: 'Gmail-X', availability: 'CONFIGURED_BUT_UNAVAILABLE' },
            effectiveSource: 'PROJECT',
            availability: 'CONFIGURED_BUT_UNAVAILABLE',
          },
        ]),
        channelCatalogHandlerWith(CATALOG),
      ])

      renderPage()

      const card = await screen.findByTestId('project-channel-EMAIL')
      expect(within(card).getByText(/Canal configurado indisponível no YCommunication/)).toBeInTheDocument()
      // Nunca cai silenciosamente para o default do Tenant (Gmail Corporativo) — continua mostrando Gmail-X.
      expect(within(card).getByText(/Canal efetivo:/)).toHaveTextContent('Gmail-X')
    })
  })
})

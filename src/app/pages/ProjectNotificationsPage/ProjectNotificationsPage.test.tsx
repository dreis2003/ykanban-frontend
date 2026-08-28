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

const PROJECT_RESPONSE = { id: 'proj-1', code: 'YK', name: 'YKanban Core', status: 'ACTIVE' }

function destinationsHandler(items: unknown[] = []): FetchHandler {
  return {
    match: (url, method) => url.includes('/notification-destinations') && method === 'GET',
    respond: () => jsonResponse(items),
  }
}

function projectHandler(): FetchHandler {
  return {
    // Só a chamada "GET o Project em si" (sem nenhum subrecurso depois do id) — .includes('/notifications')
    // não bastava para excluir /notification-templates (não contém a substring "/notifications").
    match: (url, method) => url.replace(/\?.*$/, '').endsWith('/projects/proj-1') && method === 'GET',
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

function templateCatalogHandler(items: unknown[] = []): FetchHandler {
  return {
    match: (url, method) => url.includes('/integrations/ycommunication/templates') && method === 'GET',
    respond: () => jsonResponse(items),
  }
}

function projectEventTemplatesHandler(items: unknown[] = []): FetchHandler {
  return {
    match: (url, method) => url.includes('/notification-templates') && method === 'GET',
    respond: () => jsonResponse(items),
  }
}

/** Handlers padrão (catálogo/config vazios) para toda `mockFetchRouter` desta suíte que não testa
 * diretamente a seção de templates — evita fetch não mockado quebrando os outros testes. */
function defaultTemplateHandlers(): FetchHandler[] {
  return [templateCatalogHandler([]), projectEventTemplatesHandler([])]
}

function policyCatalogHandler(items: unknown[] = []): FetchHandler {
  return {
    match: (url, method) => url.includes('/integrations/ycommunication/notification-policies') && method === 'GET',
    respond: () => jsonResponse(items),
  }
}

function projectEventPoliciesHandler(items: unknown[] = []): FetchHandler {
  return {
    match: (url, method) => url.includes('/notification-event-policies') && method === 'GET',
    respond: () => jsonResponse(items),
  }
}

/** Handlers padrão (catálogo/config vazios) para toda `mockFetchRouter` desta suíte que não testa
 * diretamente a seção de policies — evita fetch não mockado quebrando os outros testes. */
function defaultPolicyHandlers(): FetchHandler[] {
  return [policyCatalogHandler([]), projectEventPoliciesHandler([])]
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
      ...defaultTemplateHandlers(),
      ...defaultPolicyHandlers(),
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
      ...defaultTemplateHandlers(),
      ...defaultPolicyHandlers(),
      destinationsHandler([]),
      {
        match: (url, method) => url.includes('/notification-destinations') && method === 'POST',
        respond: (init) => {
          createdPayload = JSON.parse(init?.body as string)
          return jsonResponse({
            id: 'dest-2',
            projectId: 'proj-1',
            channel: 'EMAIL',
            recipientPayload: '{"email":"team@ykanban.dev"}',
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
        recipientPayload: JSON.stringify({ email: 'team@ykanban.dev' }),
        events: ['CARD_CREATED', 'CARD_MOVED', 'CARD_COMPLETED'],
        active: true,
      })
    })
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
        ...defaultTemplateHandlers(),
      ...defaultPolicyHandlers(),
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
      mockFetchRouter([
        ...defaultTemplateHandlers(),
        ...defaultPolicyHandlers(),
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([]),
      ])

      renderPage()

      expect(await screen.findByText('Nenhuma notificação enviada para este projeto.')).toBeInTheDocument()
    })

    it('shows an error state without leaking stale data on API failure', async () => {
      mockFetchRouter([
        ...defaultTemplateHandlers(),
      ...defaultPolicyHandlers(),
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
        ...defaultTemplateHandlers(),
      ...defaultPolicyHandlers(),
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
        ...defaultTemplateHandlers(),
      ...defaultPolicyHandlers(),
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
        ...defaultTemplateHandlers(),
      ...defaultPolicyHandlers(),
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
        ...defaultTemplateHandlers(),
      ...defaultPolicyHandlers(),
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
        ...defaultTemplateHandlers(),
      ...defaultPolicyHandlers(),
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
        ...defaultTemplateHandlers(),
      ...defaultPolicyHandlers(),
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

  describe('notification template configuration', () => {
    const CATALOG_ITEM = {
      code: 'YK_CARD_COMPLETED',
      name: 'Card concluído',
      description: 'Notifica conclusão de um card',
      channel: 'TELEGRAM',
      version: 3,
      variables: [
        { path: 'projectName', type: 'STRING', required: true, description: null },
        { path: 'cardKey', type: 'STRING', required: true, description: null },
      ],
    }

    const MAPPING = {
      id: 'tpl-map-1',
      projectId: 'proj-1',
      eventType: 'CARD_COMPLETED',
      channel: 'TELEGRAM',
      templateCode: 'YK_CARD_COMPLETED',
      updatedAt: '2026-08-27T12:00:00Z',
    }

    it('shows a loading state while fetching the template catalog', async () => {
      let resolveCatalog: (response: Response) => void = () => {}
      const catalogPromise = new Promise<Response>((resolve) => {
        resolveCatalog = resolve
      })

      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([]),
        projectEventTemplatesHandler([]),
        ...defaultPolicyHandlers(),
        {
          match: (url, method) => url.includes('/integrations/ycommunication/templates') && method === 'GET',
          respond: () => catalogPromise,
        },
      ])

      renderPage()

      await screen.findByRole('heading', { name: 'YKanban Core' })
      expect(screen.getByText('Carregando catálogo de templates...')).toBeInTheDocument()

      resolveCatalog(jsonResponse([]))

      await waitFor(() => {
        expect(screen.getByText('Nenhum template disponível.')).toBeInTheDocument()
      })
    })

    it('shows the empty state when the template catalog is empty', async () => {
      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([]),
        ...defaultTemplateHandlers(),
        ...defaultPolicyHandlers(),
      ])

      renderPage()

      expect(await screen.findByText('Nenhum template disponível.')).toBeInTheDocument()
    })

    it('shows an error state when the template catalog fails to load', async () => {
      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([]),
        projectEventTemplatesHandler([]),
        ...defaultPolicyHandlers(),
        {
          match: (url, method) => url.includes('/integrations/ycommunication/templates') && method === 'GET',
          respond: () => jsonResponse({ title: 'Erro interno', status: 500 }, 500),
        },
      ])

      renderPage()

      expect(await screen.findByText('Falha ao carregar o catálogo de templates.')).toBeInTheDocument()
    })

    it('lets the user select a template and shows its read-only variable contract', async () => {
      const user = userEvent.setup()
      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([]),
        templateCatalogHandler([CATALOG_ITEM]),
        projectEventTemplatesHandler([]),
        ...defaultPolicyHandlers(),
      ])

      renderPage()

      await user.selectOptions(await screen.findByLabelText('Canal'), 'TELEGRAM')
      await user.selectOptions(screen.getByLabelText('Template'), 'YK_CARD_COMPLETED')

      const contract = await screen.findByTestId('template-variable-contract')
      expect(within(contract).getByText('projectName')).toBeInTheDocument()
      expect(within(contract).getAllByText(/obrigatório/)).toHaveLength(2)
    })

    it('saves a template mapping using templateCode, never the internal UUID (which does not exist)', async () => {
      const user = userEvent.setup()
      let savedPayload: unknown = null

      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([]),
        templateCatalogHandler([CATALOG_ITEM]),
        {
          match: (url, method) => url.endsWith('/projects/proj-1/notification-templates') && method === 'GET',
          respond: () => jsonResponse([]),
        },
        {
          match: (url, method) => url.endsWith('/projects/proj-1/notification-templates') && method === 'PUT',
          respond: (init) => {
            savedPayload = JSON.parse(init?.body as string)
            return jsonResponse(MAPPING)
          },
        },
        ...defaultPolicyHandlers(),
      ])

      renderPage()

      await user.selectOptions(await screen.findByLabelText('Canal'), 'TELEGRAM')
      await user.selectOptions(screen.getByLabelText('Template'), 'YK_CARD_COMPLETED')
      await user.click(screen.getByRole('button', { name: 'Salvar' }))

      await waitFor(() => {
        expect(savedPayload).toEqual({
          eventType: 'CARD_CREATED',
          channel: 'TELEGRAM',
          templateCode: 'YK_CARD_COMPLETED',
        })
      })
    })

    it('lists configured mappings and removes one', async () => {
      const user = userEvent.setup()
      let deleteCalled = false

      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([]),
        templateCatalogHandler([CATALOG_ITEM]),
        {
          match: (url, method) => url.includes('/notification-templates') && method === 'GET',
          respond: () => jsonResponse([MAPPING]),
        },
        {
          match: (url, method) => url.includes('/notification-templates') && method === 'DELETE',
          respond: () => {
            deleteCalled = true
            return jsonResponse(null, 204)
          },
        },
        ...defaultPolicyHandlers(),
      ])

      renderPage()

      const table = await screen.findByTestId('template-mappings-table')
      expect(within(table).getByText('YK_CARD_COMPLETED')).toBeInTheDocument()
      expect(within(table).getByText('Conclusão em Produção')).toBeInTheDocument()

      await user.click(within(table).getByRole('button', { name: 'Remover' }))

      await waitFor(() => {
        expect(deleteCalled).toBe(true)
      })
    })

    it('never leaks the previous tenant/project template config on tenant switch', async () => {
      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([]),
        templateCatalogHandler([CATALOG_ITEM]),
        projectEventTemplatesHandler([MAPPING]),
        ...defaultPolicyHandlers(),
      ])

      const { rerender, queryClient } = renderPage('proj-1', authValue())

      const table = await screen.findByTestId('template-mappings-table')
      expect(within(table).getByText('YK_CARD_COMPLETED')).toBeInTheDocument()

      const otherTenantAuth = authValue({ activeTenant: { id: 't2', name: 'Outra Empresa', slug: 'outra', status: 'ACTIVE' } })
      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([]),
        ...defaultTemplateHandlers(),
        ...defaultPolicyHandlers(),
      ])
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
        expect(screen.queryByText('YK_CARD_COMPLETED')).not.toBeInTheDocument()
      })
    })

    it('never sends the YCommunication API Key or any secret header from the browser', async () => {
      let observedHeaders: Record<string, string> = {}
      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([]),
        {
          match: (url, method) => url.includes('/integrations/ycommunication/templates') && method === 'GET',
          respond: (init) => {
            observedHeaders = Object.fromEntries(new Headers(init?.headers).entries())
            return jsonResponse([CATALOG_ITEM])
          },
        },
        projectEventTemplatesHandler([]),
        ...defaultPolicyHandlers(),
      ])

      renderPage()

      await screen.findByLabelText('Canal')
      expect(Object.keys(observedHeaders).some((h) => h.toLowerCase().includes('api-key'))).toBe(false)
    })
  })

  describe('notification policy configuration', () => {
    const POLICY_ITEM = {
      code: 'YK_PROJECT_ACTIVITY',
      name: 'Atividade do Projeto',
      description: 'Notifica atividade do projeto por múltiplos canais',
      mode: 'FALLBACK',
      variables: [
        { name: 'projectName', type: 'STRING', required: true },
        { name: 'cardKey', type: 'STRING', required: true },
      ],
    }

    const POLICY_MAPPING = {
      id: 'pol-map-1',
      projectId: 'proj-1',
      eventType: 'CARD_COMPLETED',
      policyCode: 'YK_PROJECT_ACTIVITY',
      enabled: true,
      updatedAt: '2026-08-27T12:00:00Z',
    }

    it('shows a loading state while fetching the policy catalog', async () => {
      let resolveCatalog: (response: Response) => void = () => {}
      const catalogPromise = new Promise<Response>((resolve) => {
        resolveCatalog = resolve
      })

      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([]),
        ...defaultTemplateHandlers(),
        projectEventPoliciesHandler([]),
        {
          match: (url, method) => url.includes('/integrations/ycommunication/notification-policies') && method === 'GET',
          respond: () => catalogPromise,
        },
      ])

      renderPage()

      await screen.findByRole('heading', { name: 'YKanban Core' })
      expect(screen.getByText('Carregando catálogo de policies...')).toBeInTheDocument()

      resolveCatalog(jsonResponse([]))

      await waitFor(() => {
        expect(screen.getByText('Nenhuma Notification Policy disponível.')).toBeInTheDocument()
      })
    })

    it('shows the empty state when the policy catalog is empty', async () => {
      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([]),
        ...defaultTemplateHandlers(),
        ...defaultPolicyHandlers(),
      ])

      renderPage()

      expect(await screen.findByText('Nenhuma Notification Policy disponível.')).toBeInTheDocument()
    })

    it('shows an error state when the policy catalog fails to load', async () => {
      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([]),
        ...defaultTemplateHandlers(),
        projectEventPoliciesHandler([]),
        {
          match: (url, method) => url.includes('/integrations/ycommunication/notification-policies') && method === 'GET',
          respond: () => jsonResponse({ title: 'Erro interno', status: 500 }, 500),
        },
      ])

      renderPage()

      expect(await screen.findByText('Falha ao carregar o catálogo de policies.')).toBeInTheDocument()
    })

    it('lets the user select a policy and shows its mode and read-only variable contract', async () => {
      const user = userEvent.setup()
      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([]),
        ...defaultTemplateHandlers(),
        policyCatalogHandler([POLICY_ITEM]),
        projectEventPoliciesHandler([]),
      ])

      renderPage()

      await user.selectOptions(await screen.findByLabelText('Policy'), 'YK_PROJECT_ACTIVITY')

      expect(screen.getByRole('option', { name: 'YK_PROJECT_ACTIVITY — Atividade do Projeto' })).toBeInTheDocument()

      const contract = await screen.findByTestId('policy-variable-contract')
      expect(within(contract).getByTestId('policy-mode')).toHaveTextContent('FALLBACK')
      expect(within(contract).getByText('projectName')).toBeInTheDocument()
      expect(within(contract).getAllByText(/obrigatório/)).toHaveLength(2)
    })

    it('saves a policy mapping using policyCode, never the internal UUID (which does not exist)', async () => {
      const user = userEvent.setup()
      let savedPayload: unknown = null

      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([]),
        ...defaultTemplateHandlers(),
        policyCatalogHandler([POLICY_ITEM]),
        {
          match: (url, method) => url.endsWith('/projects/proj-1/notification-event-policies') && method === 'GET',
          respond: () => jsonResponse([]),
        },
        {
          match: (url, method) => url.endsWith('/projects/proj-1/notification-event-policies') && method === 'PUT',
          respond: (init) => {
            savedPayload = JSON.parse(init?.body as string)
            return jsonResponse(POLICY_MAPPING)
          },
        },
      ])

      renderPage()

      await user.selectOptions(await screen.findByLabelText('Evento'), 'CARD_COMPLETED')
      await user.selectOptions(screen.getByLabelText('Policy'), 'YK_PROJECT_ACTIVITY')
      await user.click(within(await screen.findByTestId('policy-config-form')).getByRole('button', { name: 'Salvar' }))

      await waitFor(() => {
        expect(savedPayload).toEqual({ eventType: 'CARD_COMPLETED', policyCode: 'YK_PROJECT_ACTIVITY' })
      })
    })

    it('lists configured policy mappings and removes one', async () => {
      const user = userEvent.setup()
      let deleteCalled = false

      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([]),
        ...defaultTemplateHandlers(),
        policyCatalogHandler([POLICY_ITEM]),
        {
          match: (url, method) => url.includes('/notification-event-policies') && method === 'GET',
          respond: () => jsonResponse([POLICY_MAPPING]),
        },
        {
          match: (url, method) => url.includes('/notification-event-policies') && method === 'DELETE',
          respond: () => {
            deleteCalled = true
            return jsonResponse(null, 204)
          },
        },
      ])

      renderPage()

      const table = await screen.findByTestId('policy-mappings-table')
      expect(within(table).getByText('YK_PROJECT_ACTIVITY')).toBeInTheDocument()
      expect(within(table).getByText('Conclusão em Produção')).toBeInTheDocument()

      await user.click(within(table).getByRole('button', { name: 'Remover' }))

      await waitFor(() => {
        expect(deleteCalled).toBe(true)
      })
    })

    it('warns when the same event already has a Template mapping configured', async () => {
      const TEMPLATE_MAPPING = {
        id: 'tpl-map-1',
        projectId: 'proj-1',
        eventType: 'CARD_CREATED',
        channel: 'TELEGRAM',
        templateCode: 'YK_CARD_CREATED',
        updatedAt: '2026-08-27T12:00:00Z',
      }
      const user = userEvent.setup()

      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([]),
        templateCatalogHandler([]),
        projectEventTemplatesHandler([TEMPLATE_MAPPING]),
        policyCatalogHandler([POLICY_ITEM]),
        projectEventPoliciesHandler([]),
      ])

      renderPage()

      // CARD_CREATED já é o evento padrão selecionado no formulário de policy.
      await user.selectOptions(await screen.findByLabelText('Policy'), 'YK_PROJECT_ACTIVITY')

      expect(await screen.findByTestId('policy-template-conflict-warning')).toHaveTextContent(
        'a Policy tem prioridade e será usada',
      )
    })

    it('never leaks the previous tenant/project policy config on tenant switch', async () => {
      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([]),
        ...defaultTemplateHandlers(),
        policyCatalogHandler([POLICY_ITEM]),
        projectEventPoliciesHandler([POLICY_MAPPING]),
      ])

      const { rerender, queryClient } = renderPage('proj-1', authValue())

      const table = await screen.findByTestId('policy-mappings-table')
      expect(within(table).getByText('YK_PROJECT_ACTIVITY')).toBeInTheDocument()

      const otherTenantAuth = authValue({ activeTenant: { id: 't2', name: 'Outra Empresa', slug: 'outra', status: 'ACTIVE' } })
      mockFetchRouter([
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([]),
        ...defaultTemplateHandlers(),
        ...defaultPolicyHandlers(),
      ])
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
        expect(screen.queryByText('YK_PROJECT_ACTIVITY')).not.toBeInTheDocument()
      })
    })
  })

  describe('notification detail drawer — policy mode', () => {
    const POLICY_NOTIFICATION_SUMMARY = {
      id: 'notif-policy-1',
      eventType: 'CARD_COMPLETED',
      channel: null,
      dispatchStatus: 'DISPATCHED',
      remoteStatus: null,
      createdAt: '2026-08-27T14:32:00Z',
      dispatchedAt: '2026-08-27T14:32:01Z',
      remoteStatusUpdatedAt: null,
    }

    it('shows FALLBACK routing with an unused route, never labeled as failed', async () => {
      const user = userEvent.setup()
      mockFetchRouter([
        ...defaultTemplateHandlers(),
        ...defaultPolicyHandlers(),
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([POLICY_NOTIFICATION_SUMMARY]),
        notificationDetailHandler('notif-policy-1', {
          ...POLICY_NOTIFICATION_SUMMARY,
          ycommunicationMessageId: null,
          lastError: null,
          history: [],
          deliveryMode: 'POLICY',
          policyCode: 'YK_PROJECT_ACTIVITY',
          externalNotificationId: 'ext-notif-1',
          remoteNotificationStatus: 'SUCCEEDED',
          remoteNotificationStatusUpdatedAt: '2026-08-27T14:33:00Z',
          routes: [
            { sequence: 1, channel: 'TELEGRAM', ycommunicationMessageId: 'msg-1', remoteMessageStatus: 'FAILED', remoteStatusUpdatedAt: '2026-08-27T14:32:30Z' },
            { sequence: 2, channel: 'EMAIL', ycommunicationMessageId: 'msg-2', remoteMessageStatus: 'DELIVERED', remoteStatusUpdatedAt: '2026-08-27T14:33:00Z' },
            { sequence: 3, channel: 'WHATSAPP', ycommunicationMessageId: null, remoteMessageStatus: null, remoteStatusUpdatedAt: null },
          ],
        }),
      ])

      renderPage()

      const row = await screen.findByTestId('notification-row-notif-policy-1')
      await user.click(row)

      const drawer = await screen.findByTestId('notification-policy-detail')
      expect(within(drawer).getByText('YK_PROJECT_ACTIVITY')).toBeInTheDocument()
      expect(within(drawer).getByTestId('notification-routing-status')).toHaveTextContent('Sucesso')

      const routes = within(drawer).getByTestId('notification-routes-list')
      const items = within(routes).getAllByRole('listitem')
      expect(items).toHaveLength(3)
      expect(items[0]).toHaveTextContent('1. TELEGRAM')
      expect(items[0]).toHaveTextContent('Falhou')
      expect(items[1]).toHaveTextContent('2. EMAIL')
      expect(items[1]).toHaveTextContent('Entregue')
      expect(items[2]).toHaveTextContent('3. WHATSAPP')
      expect(items[2]).toHaveTextContent('Não utilizado')
      expect(items[2]).not.toHaveTextContent('Falhou')
    })

    it('shows FAN_OUT partial success with mixed route outcomes', async () => {
      const user = userEvent.setup()
      mockFetchRouter([
        ...defaultTemplateHandlers(),
        ...defaultPolicyHandlers(),
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([POLICY_NOTIFICATION_SUMMARY]),
        notificationDetailHandler('notif-policy-1', {
          ...POLICY_NOTIFICATION_SUMMARY,
          ycommunicationMessageId: null,
          lastError: null,
          history: [],
          deliveryMode: 'POLICY',
          policyCode: 'YK_CRITICAL_ACTIVITY',
          externalNotificationId: 'ext-notif-2',
          remoteNotificationStatus: 'PARTIAL_SUCCESS',
          remoteNotificationStatusUpdatedAt: '2026-08-27T14:33:00Z',
          routes: [
            { sequence: 1, channel: 'TELEGRAM', ycommunicationMessageId: 'msg-1', remoteMessageStatus: 'DELIVERED', remoteStatusUpdatedAt: '2026-08-27T14:33:00Z' },
            { sequence: 2, channel: 'EMAIL', ycommunicationMessageId: 'msg-2', remoteMessageStatus: 'SENT', remoteStatusUpdatedAt: '2026-08-27T14:32:40Z' },
            { sequence: 3, channel: 'WHATSAPP', ycommunicationMessageId: 'msg-3', remoteMessageStatus: 'FAILED', remoteStatusUpdatedAt: '2026-08-27T14:32:35Z' },
          ],
        }),
      ])

      renderPage()

      const row = await screen.findByTestId('notification-row-notif-policy-1')
      await user.click(row)

      const drawer = await screen.findByTestId('notification-policy-detail')
      expect(within(drawer).getByTestId('notification-routing-status')).toHaveTextContent('Sucesso parcial')

      const routes = within(drawer).getByTestId('notification-routes-list')
      const items = within(routes).getAllByRole('listitem')
      expect(items[0]).toHaveTextContent('Entregue')
      expect(items[1]).toHaveTextContent('Enviado')
      expect(items[2]).toHaveTextContent('Falhou')
    })

    it('falls back safely on an unknown additive aggregate status without breaking the UI', async () => {
      const user = userEvent.setup()
      mockFetchRouter([
        ...defaultTemplateHandlers(),
        ...defaultPolicyHandlers(),
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([POLICY_NOTIFICATION_SUMMARY]),
        notificationDetailHandler('notif-policy-1', {
          ...POLICY_NOTIFICATION_SUMMARY,
          ycommunicationMessageId: null,
          lastError: null,
          history: [],
          deliveryMode: 'POLICY',
          policyCode: 'YK_PROJECT_ACTIVITY',
          externalNotificationId: 'ext-notif-3',
          remoteNotificationStatus: 'UNKNOWN_FUTURE_STATUS',
          remoteNotificationStatusUpdatedAt: '2026-08-27T14:33:00Z',
          routes: [],
        }),
      ])

      renderPage()

      const row = await screen.findByTestId('notification-row-notif-policy-1')
      await user.click(row)

      const drawer = await screen.findByTestId('notification-policy-detail')
      expect(within(drawer).getByTestId('notification-routing-status')).toHaveTextContent('UNKNOWN_FUTURE_STATUS')
    })

    it('keeps the legacy TEMPLATE-mode detail view unchanged (regression)', async () => {
      const user = userEvent.setup()
      mockFetchRouter([
        ...defaultTemplateHandlers(),
        ...defaultPolicyHandlers(),
        destinationsHandler([]),
        projectHandler(),
        notificationsListHandler([NOTIFICATION_SENT]),
        notificationDetailHandler('notif-1', {
          ...NOTIFICATION_SENT,
          ycommunicationMessageId: 'msg-abc-123',
          lastError: null,
          history: [{ status: 'DELIVERED', occurredAt: '2026-08-27T14:32:02Z' }],
          deliveryMode: 'TEMPLATE',
          policyCode: null,
          externalNotificationId: null,
          remoteNotificationStatus: null,
          remoteNotificationStatusUpdatedAt: null,
          routes: [],
        }),
      ])

      renderPage()

      const row = await screen.findByTestId('notification-row-notif-1')
      await user.click(row)

      const drawer = await screen.findByRole('dialog', { name: 'Detalhe da notificação' })
      expect(within(drawer).getByText('msg-abc-123')).toBeInTheDocument()
      expect(within(drawer).queryByTestId('notification-policy-detail')).not.toBeInTheDocument()
      expect(within(drawer).getByTestId('notification-history-timeline')).toBeInTheDocument()
    })
  })
})

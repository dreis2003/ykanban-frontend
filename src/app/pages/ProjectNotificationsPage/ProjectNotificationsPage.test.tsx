import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProjectNotificationsPage } from './ProjectNotificationsPage'

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

describe('ProjectNotificationsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function renderPage(projectId = 'proj-1') {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/projects/${projectId}/notifications`]}>
          <Routes>
            <Route path="/projects/:projectId/notifications" element={<ProjectNotificationsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it('renders project header and destination list', async () => {
    mockFetchRouter([
      {
        match: (url, method) => url.includes('/notification-destinations') && method === 'GET',
        respond: () =>
          jsonResponse([
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
      },
      {
        match: (url, method) => url.includes('/projects/proj-1') && method === 'GET',
        respond: () =>
          jsonResponse({
            id: 'proj-1',
            code: 'YK',
            name: 'YKanban Core',
            status: 'ACTIVE',
          }),
      },
    ])

    renderPage()

    expect(await screen.findByRole('heading', { name: 'YKanban Core' })).toBeInTheDocument()
    expect(await screen.findByText('-100123456')).toBeInTheDocument()
    expect(screen.getByText('TELEGRAM')).toBeInTheDocument()
    expect(screen.getByText('Criação de Card')).toBeInTheDocument()
    expect(screen.getByText('Conclusão em Produção')).toBeInTheDocument()
  })

  it('creates a new notification destination via modal', async () => {
    const user = userEvent.setup()
    let createdPayload: unknown = null

    mockFetchRouter([
      {
        match: (url, method) => url.includes('/notification-destinations') && method === 'GET',
        respond: () => jsonResponse([]),
      },
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
      {
        match: (url, method) => url.includes('/projects/proj-1') && method === 'GET',
        respond: () =>
          jsonResponse({
            id: 'proj-1',
            code: 'YK',
            name: 'YKanban Core',
            status: 'ACTIVE',
          }),
      },
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
})

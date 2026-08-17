import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProjectDashboardPage } from '@/app/pages/ProjectDashboardPage/ProjectDashboardPage'

interface FetchHandler {
  match: (url: string, method: string) => boolean
  respond: (url: string) => Response | Promise<Response>
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
      return Promise.resolve(handler.respond(url))
    }),
  )
}

const PROJECT = {
  id: 'p1',
  code: 'YK',
  name: 'YKanban',
  description: null,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-08-12T00:00:00Z',
}

const ARCHIVED_PROJECT = { ...PROJECT, status: 'ARCHIVED' }

const CURRENT_METRICS = {
  totalCards: 10,
  doingCards: 2,
  blockedCards: 1,
  unassignedCards: 3,
  productionCards: 4,
  byColumn: [
    { columnId: 'c1', columnType: 'BACKLOG', columnName: 'Backlog', position: 1, cardCount: 3 },
    { columnId: 'c3', columnType: 'DOING', columnName: 'Em Desenvolvimento', position: 3, cardCount: 2 },
    { columnId: 'c4', columnType: 'CODE_REVIEW', columnName: 'Code Review', position: 4, cardCount: 2 },
    { columnId: 'c5', columnType: 'TESTING', columnName: 'Em Testes', position: 5, cardCount: 4 },
    { columnId: 'c7', columnType: 'PRODUCTION', columnName: 'Em Produção', position: 7, cardCount: 4 },
  ],
  byType: { FEATURE: 6, BUG: 4 },
  byPriority: { MEDIUM: 5, CRITICAL: 2, HIGH: 3 },
  byAssignee: [
    { assigneeId: 'u1', assigneeName: 'Daniel Reis', inactive: false, cardCount: 5 },
    { assigneeId: null, assigneeName: null, inactive: false, cardCount: 3 },
    { assigneeId: 'u2', assigneeName: 'Maria Silva', inactive: true, cardCount: 2 },
  ],
  wip: [
    { columnId: 'c3', columnName: 'Em Desenvolvimento', wipLimit: 3, cardCount: 2 },
    { columnId: 'c4', columnName: 'Code Review', wipLimit: 2, cardCount: 2 },
    { columnId: 'c5', columnName: 'Em Testes', wipLimit: 2, cardCount: 4 },
  ],
  oldestBlockedCards: [
    {
      cardId: 'card1',
      cardKey: 'YK-1',
      cardTitle: 'Card bloqueado há dias',
      blockedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    },
  ],
}

const EMPTY_CURRENT_METRICS = {
  totalCards: 0,
  doingCards: 0,
  blockedCards: 0,
  unassignedCards: 0,
  productionCards: 0,
  byColumn: [],
  byType: {},
  byPriority: {},
  byAssignee: [],
  wip: [],
  oldestBlockedCards: [],
}

const FLOW_METRICS_30D = {
  period: '30d',
  throughput: {
    count: 5,
    previousCount: 3,
    series: [
      { bucketStart: '2026-07-20T00:00:00Z', count: 2 },
      { bucketStart: '2026-07-27T00:00:00Z', count: 3 },
    ],
  },
  leadTime: { sampleSize: 4, averageSeconds: 432000, medianSeconds: 400000 },
  cycleTime: { sampleSize: 0, averageSeconds: null, medianSeconds: null },
}

const EMPTY_FLOW_METRICS = {
  period: 'all',
  throughput: { count: 0, previousCount: null, series: [] },
  leadTime: { sampleSize: 0, averageSeconds: null, medianSeconds: null },
  cycleTime: { sampleSize: 0, averageSeconds: null, medianSeconds: null },
}

function handlersFor(
  project: unknown = PROJECT,
  current: unknown = CURRENT_METRICS,
  flow: unknown = FLOW_METRICS_30D,
): FetchHandler[] {
  return [
    { match: (url, method) => method === 'GET' && url.endsWith('/projects/p1'), respond: () => jsonResponse(project) },
    {
      match: (url, method) => method === 'GET' && url.includes('/projects/p1/metrics/current'),
      respond: () => jsonResponse(current),
    },
    {
      match: (url, method) => method === 'GET' && url.includes('/projects/p1/metrics/flow'),
      respond: () => jsonResponse(flow),
    },
  ]
}

function renderDashboard(initialPath = '/projects/p1/dashboard') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/projects/:projectId" element={<div>Página do Kanban</div>} />
          <Route path="/projects/:projectId/dashboard" element={<ProjectDashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function kpiGrid(): HTMLElement {
  const anchor = screen.getByText('Total de Cards')
  const grid = anchor.parentElement?.parentElement
  if (!grid) {
    throw new Error('Grade de KPIs não encontrada.')
  }
  return grid as HTMLElement
}

function kpiValue(titleText: string): HTMLElement {
  const title = within(kpiGrid()).getByText(titleText)
  const value = title.nextElementSibling
  if (!value) {
    throw new Error(`KPI "${titleText}" não tem um elemento de valor irmão.`)
  }
  return value as HTMLElement
}

function throughputValue(): HTMLElement {
  const title = screen.getByText('Throughput')
  const value = title.nextElementSibling
  if (!value) {
    throw new Error('Throughput não tem um elemento de valor irmão.')
  }
  return value as HTMLElement
}

describe('ProjectDashboardPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mostra KPIs, distribuição, saúde do WIP e seção de atenção com dados reais', async () => {
    mockFetchRouter(handlersFor())

    renderDashboard()

    expect(await screen.findByRole('heading', { name: 'YKanban' })).toBeInTheDocument()
    expect(kpiValue('Total de Cards')).toHaveTextContent('10')
    expect(kpiValue('Em Desenvolvimento')).toHaveTextContent('2')
    expect(kpiValue('Em Produção')).toHaveTextContent('4')

    // Code Review está 2/2 (limite atingido); Em Testes está 4/2 (2 acima do limite).
    expect(await screen.findByText('Limite atingido')).toBeInTheDocument()
    expect(screen.getByText(/2 acima do limite/)).toBeInTheDocument()

    expect(screen.getByText('Daniel Reis')).toBeInTheDocument()
    expect(screen.getByText('Sem responsável')).toBeInTheDocument()
    expect(screen.getByText('Maria Silva')).toBeInTheDocument()
    expect(screen.getByText('Inativo')).toBeInTheDocument()

    expect(screen.getByRole('link', { name: /1 card bloqueado/ })).toHaveAttribute(
      'href',
      '/projects/p1?blocked=true',
    )
    expect(screen.getByRole('link', { name: /2 cards com prioridade crítica/ })).toHaveAttribute(
      'href',
      '/projects/p1?priorities=CRITICAL',
    )
    expect(screen.getByRole('link', { name: /3 cards sem responsável/ })).toHaveAttribute(
      'href',
      '/projects/p1?unassigned=true',
    )
    expect(screen.getByRole('link', { name: 'YK-1' })).toBeInTheDocument()

    expect(throughputValue()).toHaveTextContent('5')
    expect(screen.getByText(/vs\. período anterior/)).toBeInTheDocument()
    expect(screen.getByText('5d')).toBeInTheDocument()
    expect(screen.getAllByText('Ainda não há histórico suficiente.')).toHaveLength(1)
  })

  it('projeto sem cards mostra estado vazio em vez de zeros enganosos', async () => {
    mockFetchRouter(handlersFor(PROJECT, EMPTY_CURRENT_METRICS, EMPTY_FLOW_METRICS))

    renderDashboard()

    expect(await screen.findByText('Nenhum card criado ainda.')).toBeInTheDocument()
    expect(screen.queryByText('Saúde do Fluxo')).not.toBeInTheDocument()
    expect(await screen.findAllByText('Ainda não há histórico suficiente.')).toHaveLength(2)
  })

  it('mostra erro ao carregar métricas atuais com opção de tentar novamente', async () => {
    const user = userEvent.setup()
    let attempts = 0
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.endsWith('/projects/p1'), respond: () => jsonResponse(PROJECT) },
      {
        match: (url, method) => method === 'GET' && url.includes('/projects/p1/metrics/current'),
        respond: () => {
          attempts++
          return attempts === 1
            ? jsonResponse({ title: 'Erro interno', status: 500 }, 500)
            : jsonResponse(CURRENT_METRICS)
        },
      },
      {
        match: (url, method) => method === 'GET' && url.includes('/projects/p1/metrics/flow'),
        respond: () => jsonResponse(FLOW_METRICS_30D),
      },
    ])

    renderDashboard()

    expect(await screen.findByText('Não foi possível carregar as métricas atuais.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    await waitFor(() => expect(screen.getByText('10')).toBeInTheDocument())
  })

  it('trocar o período busca novo fluxo sem refazer a busca de métricas atuais', async () => {
    const user = userEvent.setup()
    const flowCalls: string[] = []
    let currentCalls = 0
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.endsWith('/projects/p1'), respond: () => jsonResponse(PROJECT) },
      {
        match: (url, method) => method === 'GET' && url.includes('/projects/p1/metrics/current'),
        respond: () => {
          currentCalls++
          return jsonResponse(CURRENT_METRICS)
        },
      },
      {
        match: (url, method) => method === 'GET' && url.includes('/projects/p1/metrics/flow'),
        respond: (url) => {
          flowCalls.push(url)
          return jsonResponse(FLOW_METRICS_30D)
        },
      },
    ])

    renderDashboard()
    await screen.findByText('10')
    expect(flowCalls.some((url) => url.includes('period=30d'))).toBe(true)

    await user.click(screen.getByRole('radio', { name: '7 dias' }))

    await waitFor(() => expect(flowCalls.some((url) => url.includes('period=7d'))).toBe(true))
    expect(currentCalls).toBe(1)
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('permite navegar do Dashboard de volta para o Kanban pela aba', async () => {
    const user = userEvent.setup()
    mockFetchRouter(handlersFor())

    renderDashboard()
    await screen.findByRole('heading', { name: 'YKanban' })

    await user.click(screen.getByRole('link', { name: 'Kanban' }))

    expect(await screen.findByText('Página do Kanban')).toBeInTheDocument()
  })

  it('projeto arquivado mostra aviso de somente leitura e as métricas continuam acessíveis', async () => {
    mockFetchRouter(handlersFor(ARCHIVED_PROJECT))

    renderDashboard()

    expect(await screen.findByText('Este projeto está arquivado e está em modo somente leitura.')).toBeInTheDocument()
    expect(await screen.findByText('10')).toBeInTheDocument()
  })
})

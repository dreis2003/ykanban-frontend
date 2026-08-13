import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProjectDetailPage } from '@/app/pages/ProjectDetailPage/ProjectDetailPage'
import { AuthContext, type AuthContextValue } from '@/features/auth/AuthContext'

interface FetchHandler {
  match: (url: string, method: string) => boolean
  respond: () => Response | Promise<Response>
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
      return Promise.resolve(handler.respond())
    }),
  )
}

function pageOf(items: unknown[]) {
  return { content: items, page: 0, size: 200, totalElements: items.length, totalPages: items.length > 0 ? 1 : 0 }
}

const PROJECT = {
  id: 'p1',
  code: 'YK',
  name: 'YKanban',
  description: 'Gerenciamento de projetos',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-08-12T00:00:00Z',
}

const ARCHIVED_PROJECT = { ...PROJECT, status: 'ARCHIVED' }

function columnOf(id: string, type: string, name: string, position: number, wipLimit: number | null = null) {
  return { id, type, name, position, wipLimit }
}

const BOARD = {
  id: 'b1',
  projectId: 'p1',
  name: 'Kanban',
  columns: [
    columnOf('c1', 'BACKLOG', 'Backlog', 1),
    columnOf('c2', 'READY', 'Pronto para Desenvolvimento', 2),
    columnOf('c3', 'DOING', 'Em Desenvolvimento', 3, 3),
    columnOf('c4', 'CODE_REVIEW', 'Code Review', 4),
    columnOf('c5', 'TESTING', 'Em Testes', 5),
    columnOf('c6', 'READY_FOR_PRODUCTION', 'Pronto para Produção', 6),
    columnOf('c7', 'PRODUCTION', 'Em Produção', 7),
  ],
}

function cardOf(
  id: string,
  key: string,
  number: number,
  title: string,
  description: string | null,
  type: string,
  priority: string,
  columnId: string,
  columnType: string,
  columnName: string,
  position: number,
) {
  return {
    id,
    key,
    number,
    title,
    description,
    type,
    priority,
    projectId: 'p1',
    column: { id: columnId, type: columnType, name: columnName },
    position,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-05T00:00:00Z',
  }
}

// Propositalmente fora de ordem no array — a UI deve reordenar por position.
const CARD_BACKLOG_2 = cardOf('card2', 'YK-2', 2, 'Segundo card do backlog', null, 'BUG', 'LOW', 'c1', 'BACKLOG', 'Backlog', 2)
const CARD_BACKLOG_1 = cardOf(
  'card1', 'YK-1', 1, 'Primeiro card do backlog', 'Descrição do primeiro card', 'FEATURE', 'HIGH', 'c1', 'BACKLOG', 'Backlog', 1,
)
const CARD_DOING = cardOf(
  'card3', 'YK-3', 3, 'Card em desenvolvimento', null, 'TECH', 'MEDIUM', 'c3', 'DOING', 'Em Desenvolvimento', 1,
)

const CARDS_PAGE = pageOf([CARD_BACKLOG_2, CARD_BACKLOG_1, CARD_DOING])

function authValue(role: 'ADMIN' | 'DEVELOPER' | 'VIEWER'): AuthContextValue {
  return {
    user: { id: 'u1', name: 'Ana', email: 'ana@ykanban.dev', role },
    isAuthenticated: true,
    isLoading: false,
    login: async () => undefined,
    logout: async () => undefined,
  }
}

function renderDetailPage(projectId: string, role: 'ADMIN' | 'DEVELOPER' | 'VIEWER' = 'ADMIN') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue(role)}>
        <MemoryRouter initialEntries={[`/projects/${projectId}`]}>
          <Routes>
            <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

function boardAndProjectHandlers(board: unknown = BOARD, project: unknown = PROJECT, cards: unknown = CARDS_PAGE) {
  return [
    { match: (url: string, method: string) => method === 'GET' && url.includes('/projects/p1/board'), respond: () => jsonResponse(board) },
    { match: (url: string, method: string) => method === 'GET' && url.includes('/projects/p1/cards'), respond: () => jsonResponse(cards) },
    { match: (url: string, method: string) => method === 'GET' && url.endsWith('/projects/p1'), respond: () => jsonResponse(project) },
  ]
}

describe('ProjectDetailPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mostra os dados do projeto e as sete colunas do board, na ordem', async () => {
    mockFetchRouter(boardAndProjectHandlers())

    renderDetailPage('p1')

    expect(await screen.findByRole('heading', { name: 'YKanban' })).toBeInTheDocument()
    expect(screen.getByText('YK')).toBeInTheDocument()
    expect(screen.getByText('Ativo')).toBeInTheDocument()
    expect(screen.getByText('Gerenciamento de projetos')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('Backlog')).toBeInTheDocument())
    const columnNames = BOARD.columns.map((c) => c.name)
    const renderedOrder = screen
        .getAllByRole('listitem')
        .map((item) => within(item).getByRole('heading', { level: 3 }).textContent)
    expect(renderedOrder).toEqual(columnNames)
    expect(screen.getByText('WIP: 3')).toBeInTheDocument()
  })

  it('mostra erro quando o projeto não é encontrado', async () => {
    mockFetchRouter([
      {
        match: (url, method) => method === 'GET' && url.includes('/projects/unknown'),
        respond: () => jsonResponse({ title: 'Projeto não encontrado', status: 404, detail: 'Projeto não encontrado.' }, 404),
      },
    ])

    renderDetailPage('unknown')

    expect(await screen.findByText('Não foi possível carregar o projeto.')).toBeInTheDocument()
  })

  it('mostra erro quando o board falha ao carregar', async () => {
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.includes('/projects/p1/board'), respond: () => jsonResponse({ title: 'Erro interno', status: 500 }, 500) },
      { match: (url, method) => method === 'GET' && url.includes('/projects/p1/cards'), respond: () => jsonResponse(CARDS_PAGE) },
      { match: (url, method) => method === 'GET' && url.endsWith('/projects/p1'), respond: () => jsonResponse(PROJECT) },
    ])

    renderDetailPage('p1')

    await screen.findByRole('heading', { name: 'YKanban' })
    expect(await screen.findByText('Não foi possível carregar o board.')).toBeInTheDocument()
  })

  it('mostra erro quando os cards falham ao carregar', async () => {
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.includes('/projects/p1/board'), respond: () => jsonResponse(BOARD) },
      { match: (url, method) => method === 'GET' && url.includes('/projects/p1/cards'), respond: () => jsonResponse({ title: 'Erro interno', status: 500 }, 500) },
      { match: (url, method) => method === 'GET' && url.endsWith('/projects/p1'), respond: () => jsonResponse(PROJECT) },
    ])

    renderDetailPage('p1')

    await screen.findByRole('heading', { name: 'YKanban' })
    expect(await screen.findByText('Não foi possível carregar o board.')).toBeInTheDocument()
  })

  it('ADMIN pode editar uma coluna (nome e limite WIP)', async () => {
    const user = userEvent.setup()
    let updated = false
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString()
        const method = (init?.method ?? 'GET').toUpperCase()
        if (method === 'GET' && url.includes('/projects/p1/board')) {
          return Promise.resolve(jsonResponse(updated ? { ...BOARD, columns: [{ ...BOARD.columns[0], name: 'Fila', wipLimit: 5 }, ...BOARD.columns.slice(1)] } : BOARD))
        }
        if (method === 'GET' && url.includes('/projects/p1/cards')) {
          return Promise.resolve(jsonResponse(CARDS_PAGE))
        }
        if (method === 'GET' && url.endsWith('/projects/p1')) {
          return Promise.resolve(jsonResponse(PROJECT))
        }
        if (method === 'PATCH' && url.includes('/board/columns/c1')) {
          updated = true
          return Promise.resolve(jsonResponse({ ...BOARD, columns: [{ ...BOARD.columns[0], name: 'Fila', wipLimit: 5 }, ...BOARD.columns.slice(1)] }))
        }
        return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
      }),
    )

    renderDetailPage('p1')
    await screen.findByText('Backlog')

    await user.click(screen.getByRole('button', { name: 'Editar Backlog' }))
    const nameInput = screen.getByLabelText('Nome')
    await user.clear(nameInput)
    await user.type(nameInput, 'Fila')
    await user.type(screen.getByLabelText('Limite WIP'), '5')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(screen.getByText('Fila')).toBeInTheDocument())
    expect(screen.getByText('WIP: 5')).toBeInTheDocument()
  })

  it('VIEWER não vê ação de editar coluna', async () => {
    mockFetchRouter(boardAndProjectHandlers())

    renderDetailPage('p1', 'VIEWER')
    await screen.findByText('Backlog')

    expect(screen.queryByRole('button', { name: 'Editar Backlog' })).not.toBeInTheDocument()
  })

  it('projeto arquivado mostra aviso de somente leitura e oculta edição mesmo para ADMIN', async () => {
    mockFetchRouter(boardAndProjectHandlers(BOARD, ARCHIVED_PROJECT))

    renderDetailPage('p1')
    await screen.findByText('Backlog')

    expect(screen.getByText('Este projeto está arquivado e está em modo somente leitura.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar Backlog' })).not.toBeInTheDocument()
  })

  it('exibe os cards na coluna correta, ordenados por position, e "Nenhum card" onde estiver vazio', async () => {
    mockFetchRouter(boardAndProjectHandlers())

    renderDetailPage('p1')
    await screen.findByText('Backlog')

    const backlogColumn = screen.getByRole('article', { name: 'Backlog' })
    const backlogKeys = within(backlogColumn).getAllByText(/^YK-\d+$/).map((el) => el.textContent)
    expect(backlogKeys).toEqual(['YK-1', 'YK-2'])

    const doingColumn = screen.getByRole('article', { name: 'Em Desenvolvimento' })
    expect(within(doingColumn).getByText('YK-3')).toBeInTheDocument()

    const codeReviewColumn = screen.getByRole('article', { name: 'Code Review' })
    expect(within(codeReviewColumn).getByText('Nenhum card')).toBeInTheDocument()

    expect(within(backlogColumn).getByText('2')).toBeInTheDocument()
  })

  it('cria um novo card no Backlog com os defaults corretos', async () => {
    const user = userEvent.setup()
    let created = false
    const NEW_CARD = cardOf('card4', 'YK-4', 4, 'Novo card criado', null, 'FEATURE', 'MEDIUM', 'c1', 'BACKLOG', 'Backlog', 3)
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString()
        const method = (init?.method ?? 'GET').toUpperCase()
        if (method === 'GET' && url.includes('/projects/p1/board')) return Promise.resolve(jsonResponse(BOARD))
        if (method === 'GET' && url.includes('/projects/p1/cards')) {
          return Promise.resolve(jsonResponse(created ? pageOf([...CARDS_PAGE.content, NEW_CARD]) : CARDS_PAGE))
        }
        if (method === 'GET' && url.endsWith('/projects/p1')) return Promise.resolve(jsonResponse(PROJECT))
        if (method === 'POST' && url.includes('/projects/p1/cards')) {
          created = true
          return Promise.resolve(jsonResponse(NEW_CARD, 201))
        }
        return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
      }),
    )

    renderDetailPage('p1')
    await screen.findByText('Backlog')

    await user.click(screen.getByRole('button', { name: 'Novo Card' }))
    expect(screen.getByLabelText('Tipo')).toHaveValue('FEATURE')
    expect(screen.getByLabelText('Prioridade')).toHaveValue('MEDIUM')
    await user.type(screen.getByLabelText('Título'), 'Novo card criado')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(screen.getByText('YK-4')).toBeInTheDocument())
  })

  it('abre os detalhes do card e permite editar', async () => {
    const user = userEvent.setup()
    let updated = false
    const UPDATED_CARD = { ...CARD_BACKLOG_1, title: 'Título atualizado' }
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString()
        const method = (init?.method ?? 'GET').toUpperCase()
        if (method === 'GET' && url.includes('/projects/p1/board')) return Promise.resolve(jsonResponse(BOARD))
        if (method === 'GET' && url.includes('/projects/p1/cards')) {
          return Promise.resolve(
            jsonResponse(updated ? pageOf([CARD_BACKLOG_2, UPDATED_CARD, CARD_DOING]) : CARDS_PAGE),
          )
        }
        if (method === 'GET' && url.endsWith('/projects/p1')) return Promise.resolve(jsonResponse(PROJECT))
        if (method === 'PATCH' && url.includes('/cards/card1')) {
          updated = true
          return Promise.resolve(jsonResponse(UPDATED_CARD))
        }
        return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
      }),
    )

    renderDetailPage('p1')
    await screen.findByText('Backlog')

    await user.click(screen.getByText('Primeiro card do backlog'))
    expect(await screen.findByText('Descrição do primeiro card')).toBeInTheDocument()
    const detailDialog = screen.getByRole('dialog')
    expect(within(detailDialog).getByText('Funcionalidade')).toBeInTheDocument()
    expect(within(detailDialog).getByText('Alta')).toBeInTheDocument()

    await user.click(within(detailDialog).getByRole('button', { name: 'Editar' }))
    const editDialog = await screen.findByRole('dialog')
    const titleInput = within(editDialog).getByLabelText('Título')
    await user.clear(titleInput)
    await user.type(titleInput, 'Título atualizado')
    await user.click(within(editDialog).getByRole('button', { name: 'Salvar' }))

    // A atualização aparece em dois lugares ao mesmo tempo: no card do board (cache de cards
    // invalidado/recarregado) e no título do dialog de detalhes, que reabre com o dado novo.
    await waitFor(() => expect(screen.getAllByText('Título atualizado')).toHaveLength(2))
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Título atualizado' })).toBeInTheDocument()
  })

  it('VIEWER não vê ação de criar ou editar card', async () => {
    mockFetchRouter(boardAndProjectHandlers())

    renderDetailPage('p1', 'VIEWER')
    await screen.findByText('Backlog')

    expect(screen.queryByRole('button', { name: 'Novo Card' })).not.toBeInTheDocument()

    await userEvent.setup().click(screen.getByText('Primeiro card do backlog'))
    expect(await screen.findByRole('heading', { name: 'Primeiro card do backlog' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
  })

  it('DEVELOPER pode criar card mesmo sem poder editar colunas', async () => {
    mockFetchRouter(boardAndProjectHandlers())

    renderDetailPage('p1', 'DEVELOPER')
    await screen.findByText('Backlog')

    expect(screen.getByRole('button', { name: 'Novo Card' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar Backlog' })).not.toBeInTheDocument()
  })

  it('projeto arquivado oculta criação/edição de card mesmo para ADMIN', async () => {
    mockFetchRouter(boardAndProjectHandlers(BOARD, ARCHIVED_PROJECT))

    renderDetailPage('p1')
    await screen.findByText('Backlog')

    expect(screen.queryByRole('button', { name: 'Novo Card' })).not.toBeInTheDocument()
  })
})

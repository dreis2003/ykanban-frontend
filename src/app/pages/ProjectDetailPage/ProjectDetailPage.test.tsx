import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProjectDetailPage } from '@/app/pages/ProjectDetailPage/ProjectDetailPage'
import { AuthContext, type AuthContextValue } from '@/features/auth/AuthContext'

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

function pageOf(items: unknown[]) {
  return { content: items, page: 0, size: 200, totalElements: items.length, totalPages: items.length > 0 ? 1 : 0 }
}

function nth(elements: HTMLElement[], index: number): HTMLElement {
  const element = elements[index]
  if (!element) {
    throw new Error(`Elemento no índice ${index} não encontrado (array tem ${elements.length} itens).`)
  }
  return element
}

function cardIdFromUrl(url: string): string {
  return url.match(/\/cards\/([^/?]+)/)?.[1] ?? ''
}

function isIndividualCardRequest(url: string): boolean {
  return /\/cards\/[^/]+$/.test(url) && !url.includes('/projects/')
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

function columnOf(
  id: string,
  type: string,
  name: string,
  position: number,
  wipLimit: number | null = null,
  cardCount = 0,
) {
  return { id, type, name, position, wipLimit, cardCount }
}

const BOARD = {
  id: 'b1',
  projectId: 'p1',
  name: 'Kanban',
  columns: [
    columnOf('c1', 'BACKLOG', 'Backlog', 1, null, 2),
    columnOf('c2', 'READY', 'Pronto para Desenvolvimento', 2),
    columnOf('c3', 'DOING', 'Em Desenvolvimento', 3, 3, 1),
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
    acceptanceCriteria: [] as unknown[],
    labels: [] as unknown[],
    assignee: null as unknown,
    blocked: false,
    block: null as unknown,
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

const CARDS = [CARD_BACKLOG_2, CARD_BACKLOG_1, CARD_DOING]
const CARDS_BY_ID: Record<string, unknown> = { card1: CARD_BACKLOG_1, card2: CARD_BACKLOG_2, card3: CARD_DOING }

function authValue(role: 'ADMIN' | 'DEVELOPER' | 'VIEWER'): AuthContextValue {
  return {
    user: { id: 'u1', name: 'Ana', email: 'ana@ykanban.dev' },
    activeTenant: { id: 't1', name: 'Yakuza Studio', slug: 'yakuza-studio', status: 'ACTIVE' },
    membershipRole: role,
    membershipStatus: 'ACTIVE',
    authenticationContext: 'TENANT_ACCESS',
    availableTenants: [],
    isAuthenticated: true,
    isTenantSelected: true,
    isLoading: false,
    login: async () => undefined,
    selectTenant: async () => undefined,
    logout: async () => undefined,
    refreshAvailableTenants: async () => undefined,
  }
}

function renderDetailPage(
  projectId: string,
  role: 'ADMIN' | 'DEVELOPER' | 'VIEWER' = 'ADMIN',
  initialPath?: string,
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue(role)}>
        <MemoryRouter initialEntries={[initialPath ?? `/projects/${projectId}`]}>
          <Routes>
            <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="/projects/:projectId/cards/:cardId" element={<ProjectDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

function boardAndProjectHandlers(
  board: unknown = BOARD,
  project: unknown = PROJECT,
  cards: unknown = CARDS,
  cardsById: Record<string, unknown> = CARDS_BY_ID,
): FetchHandler[] {
  return [
    { match: (url, method) => method === 'GET' && url.includes('/projects/p1/board'), respond: () => jsonResponse(board) },
    { match: (url, method) => method === 'GET' && url.includes('/projects/p1/cards'), respond: () => jsonResponse(cards) },
    {
      match: (url, method) => method === 'GET' && isIndividualCardRequest(url),
      respond: (url) => {
        const card = cardsById[cardIdFromUrl(url)]
        return card ? jsonResponse(card) : jsonResponse({ title: 'Card não encontrado', status: 404 }, 404)
      },
    },
    { match: (url, method) => method === 'GET' && url.endsWith('/projects/p1'), respond: () => jsonResponse(project) },
  ]
}

describe('ProjectDetailPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mostra breadcrumb, dados do projeto e as sete colunas do board, na ordem', async () => {
    mockFetchRouter(boardAndProjectHandlers())

    renderDetailPage('p1')

    expect(await screen.findByRole('heading', { name: 'YKanban' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Projetos' })).toBeInTheDocument()
    expect(screen.getByText('YK')).toBeInTheDocument()
    expect(screen.getByText('Ativo')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('Backlog')).toBeInTheDocument())
    const columnNames = BOARD.columns.map((c) => c.name)
    const renderedOrder = screen
        .getAllByRole('listitem')
        .filter((item) => item.hasAttribute('data-column-id'))
        .map((item) => within(item).getByRole('heading', { level: 3 }).textContent)
    expect(renderedOrder).toEqual(columnNames)
    // DOING tem wipLimit=3 e 1 card carregado — exibido como "atual / limite".
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  it('mostra estrutura de skeleton enquanto o board carrega', async () => {
    let resolveBoard!: (response: Response) => void
    const pendingBoard = new Promise<Response>((resolve) => {
      resolveBoard = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString()
        const method = (init?.method ?? 'GET').toUpperCase()
        if (method === 'GET' && url.includes('/projects/p1/board')) return pendingBoard
        if (method === 'GET' && url.includes('/projects/p1/cards')) return Promise.resolve(jsonResponse(CARDS))
        if (method === 'GET' && url.endsWith('/projects/p1')) return Promise.resolve(jsonResponse(PROJECT))
        return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
      }),
    )

    const { container } = renderDetailPage('p1')

    await screen.findByRole('heading', { name: 'YKanban' })
    await waitFor(() =>
      expect(container.querySelectorAll('[class*="skeletonColumn"]').length).toBeGreaterThan(0),
    )

    resolveBoard(jsonResponse(BOARD))

    await screen.findByText('Backlog')
    expect(container.querySelectorAll('[class*="skeletonColumn"]')).toHaveLength(0)
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

  it('mostra erro do board com opção de tentar novamente', async () => {
    let attempts = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString()
        const method = (init?.method ?? 'GET').toUpperCase()
        if (method === 'GET' && url.includes('/projects/p1/board')) {
          attempts++
          return attempts === 1
            ? Promise.resolve(jsonResponse({ title: 'Erro interno', status: 500 }, 500))
            : Promise.resolve(jsonResponse(BOARD))
        }
        if (method === 'GET' && url.includes('/projects/p1/cards')) return Promise.resolve(jsonResponse(CARDS))
        if (method === 'GET' && url.endsWith('/projects/p1')) return Promise.resolve(jsonResponse(PROJECT))
        return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
      }),
    )
    const user = userEvent.setup()

    renderDetailPage('p1')

    await screen.findByRole('heading', { name: 'YKanban' })
    expect(await screen.findByText('Não foi possível carregar o quadro.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    await waitFor(() => expect(screen.getByText('Backlog')).toBeInTheDocument())
  })

  it('erro ao carregar cards é localizado e não esconde as colunas do board', async () => {
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.includes('/projects/p1/board'), respond: () => jsonResponse(BOARD) },
      { match: (url, method) => method === 'GET' && url.includes('/projects/p1/cards'), respond: () => jsonResponse({ title: 'Erro interno', status: 500 }, 500) },
      { match: (url, method) => method === 'GET' && url.endsWith('/projects/p1'), respond: () => jsonResponse(PROJECT) },
    ])

    renderDetailPage('p1')

    await screen.findByRole('heading', { name: 'YKanban' })
    expect(await screen.findByText('Não foi possível carregar os cards.')).toBeInTheDocument()
    // O board continua visível mesmo com os cards falhando.
    expect(screen.getByText('Backlog')).toBeInTheDocument()
    expect(screen.getByText('Em Desenvolvimento')).toBeInTheDocument()
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
          return Promise.resolve(jsonResponse(CARDS))
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
    // Backlog tem 2 cards carregados (card1, card2) e agora wipLimit=5.
    expect(screen.getByText('2 / 5')).toBeInTheDocument()
  })

  it('coluna no limite mostra "Limite atingido" e coluna acima do limite mostra "Acima do limite"', async () => {
    const boardWithWipStates = {
      ...BOARD,
      columns: [
        BOARD.columns[0],
        BOARD.columns[1],
        { ...BOARD.columns[2], wipLimit: 1, cardCount: 1 },
        { ...BOARD.columns[3], wipLimit: 1, cardCount: 2 },
        ...BOARD.columns.slice(4),
      ],
    }
    mockFetchRouter(boardAndProjectHandlers(boardWithWipStates))

    renderDetailPage('p1')
    await screen.findByText('Backlog')

    expect(screen.getByText('1 / 1')).toBeInTheDocument()
    expect(screen.getByText('Limite atingido')).toBeInTheDocument()
    expect(screen.getByText('2 / 1')).toBeInTheDocument()
    expect(screen.getByText('Acima do limite')).toBeInTheDocument()
  })

  it('reduzir o limite de WIP abaixo da contagem atual mostra aviso e exige confirmação', async () => {
    const user = userEvent.setup()
    let updated = false
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString()
        const method = (init?.method ?? 'GET').toUpperCase()
        const patchedBoard = { ...BOARD, columns: [{ ...BOARD.columns[0], wipLimit: 1 }, ...BOARD.columns.slice(1)] }
        if (method === 'GET' && url.includes('/projects/p1/board')) {
          return Promise.resolve(jsonResponse(updated ? patchedBoard : BOARD))
        }
        if (method === 'GET' && url.includes('/projects/p1/cards')) return Promise.resolve(jsonResponse(CARDS))
        if (method === 'GET' && url.endsWith('/projects/p1')) return Promise.resolve(jsonResponse(PROJECT))
        if (method === 'PATCH' && url.includes('/board/columns/c1')) {
          updated = true
          return Promise.resolve(jsonResponse(patchedBoard))
        }
        return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
      }),
    )

    renderDetailPage('p1')
    await screen.findByText('Backlog')

    // Backlog já tem 2 cards carregados (card1, card2) — reduzir para 1 deve avisar antes de salvar.
    await user.click(screen.getByRole('button', { name: 'Editar Backlog' }))
    await user.type(screen.getByLabelText('Limite WIP'), '1')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText(/ficará acima do WIP permitido/)).toBeInTheDocument()
    const confirmButton = screen.getByRole('button', { name: 'Confirmar mesmo assim' })

    await user.click(confirmButton)

    await waitFor(() => expect(screen.getByText('2 / 1')).toBeInTheDocument())
  })

  it('rejeita limite de WIP acima de 999 no formulário sem chamar a API', async () => {
    const user = userEvent.setup()
    mockFetchRouter(boardAndProjectHandlers())

    renderDetailPage('p1')
    await screen.findByText('Backlog')

    await user.click(screen.getByRole('button', { name: 'Editar Backlog' }))
    await user.type(screen.getByLabelText('Limite WIP'), '1000')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText(/entre 1 e 999/)).toBeInTheDocument()
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

  it('cria um novo card no Backlog pelo botão do toolbar, com os defaults corretos', async () => {
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
          return Promise.resolve(jsonResponse(created ? [...CARDS, NEW_CARD] : CARDS))
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

  it('a coluna Backlog também permite criar card via "Adicionar card"', async () => {
    mockFetchRouter(boardAndProjectHandlers())

    renderDetailPage('p1')
    await screen.findByText('Backlog')

    const backlogColumn = screen.getByRole('article', { name: 'Backlog' })
    expect(within(backlogColumn).getByRole('button', { name: 'Adicionar card' })).toBeInTheDocument()
  })

  it('abre os detalhes do card via URL, edita, e a alteração aparece no board e no drawer', async () => {
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
            jsonResponse(updated ? [CARD_BACKLOG_2, UPDATED_CARD, CARD_DOING] : CARDS),
          )
        }
        if (method === 'GET' && url.endsWith('/projects/p1')) return Promise.resolve(jsonResponse(PROJECT))
        if (method === 'GET' && isIndividualCardRequest(url)) {
          return Promise.resolve(jsonResponse(updated ? UPDATED_CARD : CARD_BACKLOG_1))
        }
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
    expect(within(detailDialog).getByText('Backlog')).toBeInTheDocument()

    await user.click(within(detailDialog).getByRole('button', { name: 'Editar' }))
    const editDialog = await screen.findByRole('dialog')
    const titleInput = within(editDialog).getByLabelText('Título')
    await user.clear(titleInput)
    await user.type(titleInput, 'Título atualizado')
    await user.click(within(editDialog).getByRole('button', { name: 'Salvar' }))

    // A atualização aparece em dois lugares ao mesmo tempo: no card do board (cache de cards
    // invalidado/recarregado) e no título do drawer de detalhes, que reabre com o dado novo.
    await waitFor(() => expect(screen.getAllByText('Título atualizado')).toHaveLength(2))
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Título atualizado' })).toBeInTheDocument()
  })

  it('acessar diretamente a URL do card abre o drawer com loading e depois os detalhes', async () => {
    mockFetchRouter(boardAndProjectHandlers())

    renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card2')

    const detailDialog = await screen.findByRole('dialog')
    expect(await within(detailDialog).findByText('Segundo card do backlog')).toBeInTheDocument()
    expect(within(detailDialog).getByText('YK-2')).toBeInTheDocument()
  })

  it('fechar o drawer de detalhes volta para a URL do projeto', async () => {
    const user = userEvent.setup()
    mockFetchRouter(boardAndProjectHandlers())

    renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
    const detailDialog = await screen.findByRole('dialog')
    expect(await within(detailDialog).findByText('Primeiro card do backlog')).toBeInTheDocument()

    await user.click(within(detailDialog).getByRole('button', { name: 'Fechar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('URL de card desconhecido mostra erro dentro do drawer', async () => {
    mockFetchRouter(boardAndProjectHandlers())

    renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card-inexistente')
    await screen.findByText('Backlog')

    expect(await screen.findByText('Não foi possível carregar o card.')).toBeInTheDocument()
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
    const backlogColumn = screen.getByRole('article', { name: 'Backlog' })
    expect(within(backlogColumn).queryByRole('button', { name: 'Adicionar card' })).not.toBeInTheDocument()
  })

  describe('Critérios de Aceite', () => {
    function acceptanceCriterionOf(id: string, description: string, completed: boolean, position: number) {
      return { id, description, completed, position, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }
    }

    it('mostra estado vazio e permite criar um critério que permanece disponível para o próximo', async () => {
      const user = userEvent.setup()
      let card = { ...CARD_BACKLOG_1 }
      const created = acceptanceCriterionOf('ac1', 'Usuário consegue autenticar.', false, 1)
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
          const url = input.toString()
          const method = (init?.method ?? 'GET').toUpperCase()
          if (method === 'GET' && url.includes('/projects/p1/board')) return Promise.resolve(jsonResponse(BOARD))
          if (method === 'GET' && url.includes('/projects/p1/cards')) return Promise.resolve(jsonResponse(CARDS))
          if (method === 'GET' && url.endsWith('/projects/p1')) return Promise.resolve(jsonResponse(PROJECT))
          if (method === 'GET' && isIndividualCardRequest(url)) return Promise.resolve(jsonResponse(card))
          if (method === 'POST' && url.includes('/cards/card1/acceptance-criteria')) {
            card = { ...card, acceptanceCriteria: [created] }
            return Promise.resolve(jsonResponse(created, 201))
          }
          return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
        }),
      )

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      expect(await within(dialog).findByText('Nenhum critério de aceite definido.')).toBeInTheDocument()

      const input = within(dialog).getByLabelText('Descrição do novo critério de aceite')
      await user.type(input, 'Usuário consegue autenticar.')
      await user.click(within(dialog).getByRole('button', { name: 'Adicionar' }))

      expect(await within(dialog).findByText('Usuário consegue autenticar.')).toBeInTheDocument()
      expect(within(dialog).getByText('0/1')).toBeInTheDocument()
      // Input some limpo e disponível para o próximo critério, sem fechar nada.
      expect(within(dialog).getByLabelText('Descrição do novo critério de aceite')).toHaveValue('')
    })

    it('exibe progresso e permite concluir/reabrir um critério, persistindo a alteração', async () => {
      const user = userEvent.setup()
      const criteria = [
        acceptanceCriterionOf('ac1', 'Login com e-mail e senha', false, 1),
        acceptanceCriterionOf('ac2', 'JWT gerado corretamente', true, 2),
      ]
      const cardWithCriteria = { ...CARD_BACKLOG_1, acceptanceCriteria: criteria }
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
          const url = input.toString()
          const method = (init?.method ?? 'GET').toUpperCase()
          if (method === 'GET' && url.includes('/projects/p1/board')) return Promise.resolve(jsonResponse(BOARD))
          if (method === 'GET' && url.includes('/projects/p1/cards')) {
            return Promise.resolve(jsonResponse([CARD_BACKLOG_2, cardWithCriteria, CARD_DOING]))
          }
          if (method === 'GET' && url.endsWith('/projects/p1')) return Promise.resolve(jsonResponse(PROJECT))
          if (method === 'GET' && isIndividualCardRequest(url)) return Promise.resolve(jsonResponse(cardWithCriteria))
          if (method === 'POST' && url.includes('/acceptance-criteria/ac1/complete')) {
            return Promise.resolve(jsonResponse({ ...criteria[0], completed: true }))
          }
          return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
        }),
      )

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Login com e-mail e senha')
      expect(within(dialog).getByText('1/2')).toBeInTheDocument()

      await user.click(within(dialog).getByRole('checkbox', { name: 'Concluir critério: Login com e-mail e senha' }))

      await waitFor(() => expect(within(dialog).getByText('2/2')).toBeInTheDocument())
    })

    it('reverte o checkbox quando o backend rejeita a conclusão', async () => {
      const user = userEvent.setup()
      const criteria = [acceptanceCriterionOf('ac1', 'Critério que vai falhar', false, 1)]
      const cardWithCriteria = { ...CARD_BACKLOG_1, acceptanceCriteria: criteria }
      mockFetchRouter([
        ...boardAndProjectHandlers(BOARD, PROJECT, CARDS, { card1: cardWithCriteria }),
        {
          match: (url, method) => method === 'POST' && url.includes('/acceptance-criteria/ac1/complete'),
          respond: () => jsonResponse({ title: 'Erro interno', status: 500, detail: 'Falha ao concluir.' }, 500),
        },
      ])

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      const checkbox = await within(dialog).findByRole('checkbox', { name: 'Concluir critério: Critério que vai falhar' })

      await user.click(checkbox)

      await waitFor(() => expect(checkbox).not.toBeChecked())
      expect(await within(dialog).findByText('Falha ao concluir.')).toBeInTheDocument()
    })

    it('permite editar a descrição de um critério inline', async () => {
      const user = userEvent.setup()
      const criteria = [acceptanceCriterionOf('ac1', 'Descrição original', false, 1)]
      const cardWithCriteria = { ...CARD_BACKLOG_1, acceptanceCriteria: criteria }
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
          const url = input.toString()
          const method = (init?.method ?? 'GET').toUpperCase()
          if (method === 'GET' && url.includes('/projects/p1/board')) return Promise.resolve(jsonResponse(BOARD))
          if (method === 'GET' && url.includes('/projects/p1/cards')) return Promise.resolve(jsonResponse(CARDS))
          if (method === 'GET' && url.endsWith('/projects/p1')) return Promise.resolve(jsonResponse(PROJECT))
          if (method === 'GET' && isIndividualCardRequest(url)) return Promise.resolve(jsonResponse(cardWithCriteria))
          if (method === 'PATCH' && url.includes('/acceptance-criteria/ac1')) {
            return Promise.resolve(jsonResponse({ ...criteria[0], description: 'Descrição atualizada' }))
          }
          return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
        }),
      )

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await user.click(await within(dialog).findByText('Descrição original'))
      const editInput = within(dialog).getByLabelText('Editar descrição do critério')
      await user.clear(editInput)
      await user.type(editInput, 'Descrição atualizada')
      await user.keyboard('{Enter}')

      expect(await within(dialog).findByText('Descrição atualizada')).toBeInTheDocument()
    })

    it('remove um critério após confirmação e resequencia os demais', async () => {
      const user = userEvent.setup()
      const criteria = [
        acceptanceCriterionOf('ac1', 'Critério A', false, 1),
        acceptanceCriterionOf('ac2', 'Critério B', false, 2),
        acceptanceCriterionOf('ac3', 'Critério C', false, 3),
      ]
      const cardWithCriteria = { ...CARD_BACKLOG_1, acceptanceCriteria: criteria }
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
          const url = input.toString()
          const method = (init?.method ?? 'GET').toUpperCase()
          if (method === 'GET' && url.includes('/projects/p1/board')) return Promise.resolve(jsonResponse(BOARD))
          if (method === 'GET' && url.includes('/projects/p1/cards')) return Promise.resolve(jsonResponse(CARDS))
          if (method === 'GET' && url.endsWith('/projects/p1')) return Promise.resolve(jsonResponse(PROJECT))
          if (method === 'GET' && isIndividualCardRequest(url)) return Promise.resolve(jsonResponse(cardWithCriteria))
          if (method === 'DELETE' && url.includes('/acceptance-criteria/ac2')) {
            return Promise.resolve({ ok: true, status: 204, headers: new Headers(), json: () => Promise.resolve(undefined) } as Response)
          }
          return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
        }),
      )

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Critério B')

      const rowB = within(dialog).getByText('Critério B').closest('li') as HTMLElement
      await user.click(within(rowB).getByRole('button', { name: 'Remover critério' }))
      const confirmHeading = await screen.findByText('Remover critério de aceite')
      const confirmDialog = confirmHeading.closest('dialog') as HTMLElement
      await user.click(within(confirmDialog).getByRole('button', { name: 'Remover' }))

      await waitFor(() => expect(within(dialog).queryByText('Critério B')).not.toBeInTheDocument())
      expect(within(dialog).getByText('Critério A')).toBeInTheDocument()
      expect(within(dialog).getByText('Critério C')).toBeInTheDocument()
    })

    it('VIEWER só visualiza os critérios, sem formulário de criação, checkbox habilitado ou remoção', async () => {
      const criteria = [acceptanceCriterionOf('ac1', 'Critério somente leitura', false, 1)]
      const cardWithCriteria = { ...CARD_BACKLOG_1, acceptanceCriteria: criteria }
      mockFetchRouter(boardAndProjectHandlers(BOARD, PROJECT, CARDS, { card1: cardWithCriteria }))

      renderDetailPage('p1', 'VIEWER', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Critério somente leitura')

      expect(within(dialog).queryByLabelText('Descrição do novo critério de aceite')).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('button', { name: 'Remover critério' })).not.toBeInTheDocument()
      expect(within(dialog).getByRole('checkbox', { name: /Critério somente leitura/ })).toBeDisabled()
    })

    it('projeto arquivado deixa os critérios somente leitura mesmo para ADMIN', async () => {
      const criteria = [acceptanceCriterionOf('ac1', 'Critério de projeto arquivado', false, 1)]
      const cardWithCriteria = { ...CARD_BACKLOG_1, acceptanceCriteria: criteria }
      mockFetchRouter(boardAndProjectHandlers(BOARD, ARCHIVED_PROJECT, CARDS, { card1: cardWithCriteria }))

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Critério de projeto arquivado')

      expect(within(dialog).queryByLabelText('Descrição do novo critério de aceite')).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('button', { name: 'Remover critério' })).not.toBeInTheDocument()
    })

    it('mostra o progresso de critérios no KanbanCard do board', async () => {
      const criteria = [
        acceptanceCriterionOf('ac1', 'Critério 1', true, 1),
        acceptanceCriterionOf('ac2', 'Critério 2', true, 2),
        acceptanceCriterionOf('ac3', 'Critério 3', false, 3),
      ]
      const cardWithCriteria = { ...CARD_BACKLOG_1, acceptanceCriteria: criteria }
      mockFetchRouter(
        boardAndProjectHandlers(BOARD, PROJECT, [CARD_BACKLOG_2, cardWithCriteria, CARD_DOING], {
          card1: cardWithCriteria,
        }),
      )

      renderDetailPage('p1')
      await screen.findByText('Backlog')

      expect(await screen.findByText('2/3')).toBeInTheDocument()
    })
  })

  describe('Labels', () => {
    function labelOf(id: string, name: string, color: string) {
      return { id, name, color, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }
    }

    it('mostra as labels do card no KanbanCard, limitando a 3 visíveis com "+N"', async () => {
      const labels = [
        labelOf('l1', 'Backend', '#3B82F6'),
        labelOf('l2', 'Security', '#EF4444'),
        labelOf('l3', 'DevOps', '#F59E0B'),
        labelOf('l4', 'Urgent', '#EC4899'),
      ]
      const cardWithLabels = { ...CARD_BACKLOG_1, labels }
      mockFetchRouter(
        boardAndProjectHandlers(BOARD, PROJECT, [CARD_BACKLOG_2, cardWithLabels, CARD_DOING], {
          card1: cardWithLabels,
        }),
      )

      renderDetailPage('p1')
      await screen.findByText('Backlog')

      expect(screen.getByText('Backend')).toBeInTheDocument()
      expect(screen.getByText('Security')).toBeInTheDocument()
      expect(screen.getByText('DevOps')).toBeInTheDocument()
      expect(screen.queryByText('Urgent')).not.toBeInTheDocument()
      expect(screen.getByText('+1')).toBeInTheDocument()
    })

    it('permite associar uma label existente ao card pelo seletor', async () => {
      const user = userEvent.setup()
      const backend = labelOf('l1', 'Backend', '#3B82F6')
      let card = { ...CARD_BACKLOG_1 }
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
          const url = input.toString()
          const method = (init?.method ?? 'GET').toUpperCase()
          if (method === 'GET' && url.includes('/projects/p1/board')) return Promise.resolve(jsonResponse(BOARD))
          if (method === 'GET' && url.includes('/projects/p1/cards')) return Promise.resolve(jsonResponse(CARDS))
          if (method === 'GET' && url.endsWith('/projects/p1')) return Promise.resolve(jsonResponse(PROJECT))
          if (method === 'GET' && url.includes('/projects/p1/labels')) return Promise.resolve(jsonResponse([backend]))
          if (method === 'GET' && isIndividualCardRequest(url)) return Promise.resolve(jsonResponse(card))
          if (method === 'POST' && url.includes('/cards/card1/labels/l1')) {
            card = { ...card, labels: [backend] }
            return Promise.resolve(jsonResponse([backend]))
          }
          return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
        }),
      )

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Primeiro card do backlog')
      await user.click(within(dialog).getByRole('button', { name: 'Adicionar label' }))
      await user.click(await within(dialog).findByRole('button', { name: /Backend/ }))

      expect(await within(dialog).findByText('Backend')).toBeInTheDocument()
    })

    it('remove uma label do card e reverte em caso de erro do backend', async () => {
      const user = userEvent.setup()
      const backend = labelOf('l1', 'Backend', '#3B82F6')
      const cardWithLabel = { ...CARD_BACKLOG_1, labels: [backend] }
      mockFetchRouter([
        ...boardAndProjectHandlers(BOARD, PROJECT, CARDS, { card1: cardWithLabel }),
        {
          match: (url, method) => method === 'DELETE' && url.includes('/cards/card1/labels/l1'),
          respond: () => jsonResponse({ title: 'Erro interno', status: 500, detail: 'Falha ao remover label.' }, 500),
        },
      ])

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Backend')

      await user.click(within(dialog).getByRole('button', { name: 'Remover label Backend' }))

      expect(await within(dialog).findByText('Falha ao remover label.')).toBeInTheDocument()
      expect(within(dialog).getByText('Backend')).toBeInTheDocument()
    })

    it('VIEWER visualiza labels sem poder adicionar ou remover', async () => {
      const backend = labelOf('l1', 'Backend', '#3B82F6')
      const cardWithLabel = { ...CARD_BACKLOG_1, labels: [backend] }
      mockFetchRouter(boardAndProjectHandlers(BOARD, PROJECT, CARDS, { card1: cardWithLabel }))

      renderDetailPage('p1', 'VIEWER', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Backend')

      expect(within(dialog).queryByRole('button', { name: 'Adicionar label' })).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('button', { name: 'Remover label Backend' })).not.toBeInTheDocument()
    })

    it('DEVELOPER pode associar labels mas não vê a opção de criar nova label no catálogo', async () => {
      const user = userEvent.setup()
      const backend = labelOf('l1', 'Backend', '#3B82F6')
      mockFetchRouter([
        ...boardAndProjectHandlers(BOARD, PROJECT, CARDS, { card1: CARD_BACKLOG_1 }),
        { match: (url, method) => method === 'GET' && url.includes('/projects/p1/labels'), respond: () => jsonResponse([backend]) },
      ])

      renderDetailPage('p1', 'DEVELOPER', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Primeiro card do backlog')
      await user.click(within(dialog).getByRole('button', { name: 'Adicionar label' }))

      await within(dialog).findByRole('button', { name: /Backend/ })
      expect(within(dialog).queryByRole('button', { name: 'Criar nova label' })).not.toBeInTheDocument()
    })

    it('projeto arquivado mostra labels do card somente leitura', async () => {
      const backend = labelOf('l1', 'Backend', '#3B82F6')
      const cardWithLabel = { ...CARD_BACKLOG_1, labels: [backend] }
      mockFetchRouter(boardAndProjectHandlers(BOARD, ARCHIVED_PROJECT, CARDS, { card1: cardWithLabel }))

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Backend')

      expect(within(dialog).queryByRole('button', { name: 'Adicionar label' })).not.toBeInTheDocument()
    })

    it('ADMIN gerencia o catálogo: cria, edita e exclui uma label', async () => {
      const user = userEvent.setup()
      let labels: Array<{ id: string; name: string; color: string; createdAt: string; updatedAt: string }> = []
      const created = labelOf('l1', 'Backend', '#6B7280')
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
          const url = input.toString()
          const method = (init?.method ?? 'GET').toUpperCase()
          if (method === 'GET' && url.includes('/projects/p1/board')) return Promise.resolve(jsonResponse(BOARD))
          if (method === 'GET' && url.includes('/projects/p1/cards')) return Promise.resolve(jsonResponse(CARDS))
          if (method === 'GET' && url.endsWith('/projects/p1')) return Promise.resolve(jsonResponse(PROJECT))
          if (method === 'GET' && url.includes('/projects/p1/labels')) return Promise.resolve(jsonResponse(labels))
          if (method === 'POST' && url.includes('/projects/p1/labels')) {
            labels = [created]
            return Promise.resolve(jsonResponse(created, 201))
          }
          if (method === 'PATCH' && url.includes('/projects/p1/labels/l1')) {
            labels = [{ ...created, name: 'API' }]
            return Promise.resolve(jsonResponse({ ...created, name: 'API' }))
          }
          if (method === 'DELETE' && url.includes('/projects/p1/labels/l1')) {
            labels = []
            return Promise.resolve({ ok: true, status: 204, headers: new Headers(), json: () => Promise.resolve(undefined) } as Response)
          }
          return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
        }),
      )

      renderDetailPage('p1')
      await screen.findByText('Backlog')

      await user.click(screen.getByRole('button', { name: 'Labels' }))
      const managementHeading = await screen.findByText('Labels do Projeto')
      const managementDialog = managementHeading.closest('dialog') as HTMLElement
      expect(await within(managementDialog).findByText('Nenhuma label cadastrada. Crie labels para organizar os cards.')).toBeInTheDocument()

      await user.type(within(managementDialog).getByLabelText('Nome da nova label'), 'Backend')
      await user.click(within(managementDialog).getByRole('button', { name: '+ Criar Label' }))
      expect(await within(managementDialog).findByText('Backend')).toBeInTheDocument()

      await user.click(within(managementDialog).getByRole('button', { name: 'Editar label Backend' }))
      const nameInput = within(managementDialog).getByLabelText('Nome da label')
      await user.clear(nameInput)
      await user.type(nameInput, 'API')
      await user.click(within(managementDialog).getByRole('button', { name: 'Salvar' }))
      expect(await within(managementDialog).findByText('API')).toBeInTheDocument()

      await user.click(within(managementDialog).getByRole('button', { name: 'Excluir label API' }))
      const confirmDialog = (await screen.findByText('Excluir label')).closest('dialog') as HTMLElement
      await user.click(within(confirmDialog).getByRole('button', { name: 'Excluir' }))

      await waitFor(() =>
        expect(
          within(managementDialog).getByText('Nenhuma label cadastrada. Crie labels para organizar os cards.'),
        ).toBeInTheDocument(),
      )
    })
  })

  describe('Responsável', () => {
    function userOf(id: string, name: string, email: string, status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE') {
      return { id, name, email, status }
    }

    function usersPage(users: ReturnType<typeof userOf>[]) {
      return { content: users, page: 0, size: 10, totalElements: users.length, totalPages: 1 }
    }

    it('mostra o avatar do responsável no KanbanCard e omite quando não há responsável', async () => {
      const daniel = userOf('u2', 'Daniel Reis', 'daniel@ykanban.dev')
      const cardWithAssignee = { ...CARD_BACKLOG_1, assignee: daniel }
      mockFetchRouter(
        boardAndProjectHandlers(BOARD, PROJECT, [CARD_BACKLOG_2, cardWithAssignee, CARD_DOING], {
          card1: cardWithAssignee,
        }),
      )

      renderDetailPage('p1')
      await screen.findByText('Backlog')

      expect(screen.getByRole('img', { name: 'Daniel Reis' })).toHaveTextContent('DR')
      // Só o card com assignee tem avatar — os outros dois (sem responsável) não renderizam nenhum.
      expect(screen.getAllByRole('img')).toHaveLength(1)
    })

    it('permite atribuir um responsável pelo seletor com busca', async () => {
      const user = userEvent.setup()
      const daniel = userOf('u2', 'Daniel Reis', 'daniel@ykanban.dev')
      let card = { ...CARD_BACKLOG_1 }
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
          const url = input.toString()
          const method = (init?.method ?? 'GET').toUpperCase()
          if (method === 'GET' && url.includes('/projects/p1/board')) return Promise.resolve(jsonResponse(BOARD))
          if (method === 'GET' && url.includes('/projects/p1/cards')) return Promise.resolve(jsonResponse(CARDS))
          if (method === 'GET' && url.endsWith('/projects/p1')) return Promise.resolve(jsonResponse(PROJECT))
          if (method === 'GET' && url.includes('/users')) return Promise.resolve(jsonResponse(usersPage([daniel])))
          if (method === 'GET' && isIndividualCardRequest(url)) return Promise.resolve(jsonResponse(card))
          if (method === 'POST' && url.includes('/cards/card1/assignee')) {
            card = { ...card, assignee: daniel }
            return Promise.resolve(jsonResponse(card))
          }
          return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
        }),
      )

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Primeiro card do backlog')
      await user.click(within(dialog).getByRole('button', { name: 'Atribuir responsável' }))
      await user.click(await within(dialog).findByRole('button', { name: /Daniel Reis/ }))

      expect(await within(dialog).findByText('Daniel Reis')).toBeInTheDocument()
    })

    it('remove o responsável e reverte em caso de erro do backend', async () => {
      const user = userEvent.setup()
      const daniel = userOf('u2', 'Daniel Reis', 'daniel@ykanban.dev')
      const cardWithAssignee = { ...CARD_BACKLOG_1, assignee: daniel }
      mockFetchRouter([
        ...boardAndProjectHandlers(BOARD, PROJECT, CARDS, { card1: cardWithAssignee }),
        {
          match: (url, method) => method === 'DELETE' && url.includes('/cards/card1/assignee'),
          respond: () => jsonResponse({ title: 'Erro interno', status: 500, detail: 'Falha ao remover responsável.' }, 500),
        },
      ])

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Daniel Reis')

      await user.click(within(dialog).getByRole('button', { name: 'Remover responsável' }))

      expect(await within(dialog).findByText('Falha ao remover responsável.')).toBeInTheDocument()
      expect(within(dialog).getByText('Daniel Reis')).toBeInTheDocument()
    })

    it('"Atribuir a mim" atribui o usuário autenticado', async () => {
      const user = userEvent.setup()
      let card = { ...CARD_BACKLOG_1 }
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
          const url = input.toString()
          const method = (init?.method ?? 'GET').toUpperCase()
          if (method === 'GET' && url.includes('/projects/p1/board')) return Promise.resolve(jsonResponse(BOARD))
          if (method === 'GET' && url.includes('/projects/p1/cards')) return Promise.resolve(jsonResponse(CARDS))
          if (method === 'GET' && url.endsWith('/projects/p1')) return Promise.resolve(jsonResponse(PROJECT))
          if (method === 'GET' && isIndividualCardRequest(url)) return Promise.resolve(jsonResponse(card))
          if (method === 'POST' && url.includes('/cards/card1/assignee')) {
            card = { ...card, assignee: userOf('u1', 'Ana', 'ana@ykanban.dev') }
            return Promise.resolve(jsonResponse(card))
          }
          return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
        }),
      )

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Primeiro card do backlog')
      await user.click(within(dialog).getByRole('button', { name: 'Atribuir a mim' }))

      expect(await within(dialog).findByText('Ana')).toBeInTheDocument()
    })

    it('VIEWER visualiza o responsável sem poder gerenciar', async () => {
      const daniel = userOf('u2', 'Daniel Reis', 'daniel@ykanban.dev')
      const cardWithAssignee = { ...CARD_BACKLOG_1, assignee: daniel }
      mockFetchRouter(boardAndProjectHandlers(BOARD, PROJECT, CARDS, { card1: cardWithAssignee }))

      renderDetailPage('p1', 'VIEWER', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Daniel Reis')

      expect(within(dialog).queryByRole('button', { name: 'Trocar responsável' })).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('button', { name: 'Remover responsável' })).not.toBeInTheDocument()
    })

    it('projeto arquivado mostra o responsável somente leitura', async () => {
      const daniel = userOf('u2', 'Daniel Reis', 'daniel@ykanban.dev')
      const cardWithAssignee = { ...CARD_BACKLOG_1, assignee: daniel }
      mockFetchRouter(boardAndProjectHandlers(BOARD, ARCHIVED_PROJECT, CARDS, { card1: cardWithAssignee }))

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Daniel Reis')

      expect(within(dialog).queryByRole('button', { name: 'Trocar responsável' })).not.toBeInTheDocument()
    })

    it('responsável atual inativo continua visível com indicação discreta', async () => {
      const inactiveUser = userOf('u2', 'Daniel Reis', 'daniel@ykanban.dev', 'INACTIVE')
      const cardWithAssignee = { ...CARD_BACKLOG_1, assignee: inactiveUser }
      mockFetchRouter(boardAndProjectHandlers(BOARD, PROJECT, CARDS, { card1: cardWithAssignee }))

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Daniel Reis')

      expect(within(dialog).getByText('Inativo')).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Trocar responsável' })).toBeInTheDocument()
    })
  })

  describe('Bloqueio', () => {
    function blockOf(reason: string, blockedByName: string) {
      return { reason, blockedAt: '2026-08-14T22:30:00Z', blockedBy: { id: 'u2', name: blockedByName } }
    }

    it('mostra "Não bloqueado" e nenhum indicador no KanbanCard quando o card não está bloqueado', async () => {
      mockFetchRouter(boardAndProjectHandlers())

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')

      expect(await within(dialog).findByText('Não bloqueado')).toBeInTheDocument()
      expect(screen.queryByText('Bloqueado')).not.toBeInTheDocument()
    })

    it('mostra o indicador no KanbanCard e o motivo/responsável/data no detalhe quando bloqueado', async () => {
      const blockedCard = { ...CARD_BACKLOG_1, blocked: true, block: blockOf('Aguardando API externa.', 'Daniel Reis') }
      mockFetchRouter(
        boardAndProjectHandlers(BOARD, PROJECT, [CARD_BACKLOG_2, blockedCard, CARD_DOING], {
          card1: blockedCard,
        }),
      )

      renderDetailPage('p1')
      await screen.findByText('Backlog')

      expect(screen.getByText('Bloqueado')).toBeInTheDocument()

      await userEvent.setup().click(screen.getByText('Primeiro card do backlog'))
      const dialog = await screen.findByRole('dialog')
      expect(await within(dialog).findByText('Card bloqueado')).toBeInTheDocument()
      expect(within(dialog).getByText('Aguardando API externa.')).toBeInTheDocument()
      expect(within(dialog).getByText(/Bloqueado por Daniel Reis em/)).toBeInTheDocument()
    })

    it('permite bloquear o card informando o motivo', async () => {
      const user = userEvent.setup()
      let card = { ...CARD_BACKLOG_1 }
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
          const url = input.toString()
          const method = (init?.method ?? 'GET').toUpperCase()
          if (method === 'GET' && url.includes('/projects/p1/board')) return Promise.resolve(jsonResponse(BOARD))
          if (method === 'GET' && url.includes('/projects/p1/cards')) return Promise.resolve(jsonResponse(CARDS))
          if (method === 'GET' && url.endsWith('/projects/p1')) return Promise.resolve(jsonResponse(PROJECT))
          if (method === 'GET' && isIndividualCardRequest(url)) return Promise.resolve(jsonResponse(card))
          if (method === 'POST' && url.includes('/cards/card1/block')) {
            card = { ...card, blocked: true, block: blockOf('Aguardando definição da regra.', 'Ana') }
            return Promise.resolve(jsonResponse(card))
          }
          return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
        }),
      )

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Primeiro card do backlog')
      await user.click(within(dialog).getByRole('button', { name: 'Bloquear Card' }))
      await user.type(within(dialog).getByLabelText('Motivo do bloqueio'), 'Aguardando definição da regra.')
      await user.click(within(dialog).getByRole('button', { name: 'Bloquear' }))

      expect(await within(dialog).findByText('Card bloqueado')).toBeInTheDocument()
      expect(within(dialog).getByText('Aguardando definição da regra.')).toBeInTheDocument()
    })

    it('valida o motivo do bloqueio no cliente antes de enviar', async () => {
      const user = userEvent.setup()
      mockFetchRouter(boardAndProjectHandlers())

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Primeiro card do backlog')
      await user.click(within(dialog).getByRole('button', { name: 'Bloquear Card' }))
      await user.click(within(dialog).getByRole('button', { name: 'Bloquear' }))

      expect(await within(dialog).findByText('Informe o motivo do bloqueio.')).toBeInTheDocument()
    })

    it('mostra erro amigável quando o backend rejeita o bloqueio', async () => {
      const user = userEvent.setup()
      mockFetchRouter([
        ...boardAndProjectHandlers(),
        {
          match: (url, method) => method === 'POST' && url.includes('/cards/card1/block'),
          respond: () => jsonResponse({ title: 'Card já bloqueado', status: 409, detail: 'O card já está bloqueado.' }, 409),
        },
      ])

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Primeiro card do backlog')
      await user.click(within(dialog).getByRole('button', { name: 'Bloquear Card' }))
      await user.type(within(dialog).getByLabelText('Motivo do bloqueio'), 'Motivo válido para o teste.')
      await user.click(within(dialog).getByRole('button', { name: 'Bloquear' }))

      expect(await within(dialog).findByText('O card já está bloqueado.')).toBeInTheDocument()
    })

    it('permite desbloquear o card após confirmação', async () => {
      const user = userEvent.setup()
      let card: { blocked: boolean; block: ReturnType<typeof blockOf> | null } & Record<string, unknown> = {
        ...CARD_BACKLOG_1,
        blocked: true,
        block: blockOf('Motivo válido para o teste.', 'Ana'),
      }
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
          const url = input.toString()
          const method = (init?.method ?? 'GET').toUpperCase()
          if (method === 'GET' && url.includes('/projects/p1/board')) return Promise.resolve(jsonResponse(BOARD))
          if (method === 'GET' && url.includes('/projects/p1/cards')) return Promise.resolve(jsonResponse(CARDS))
          if (method === 'GET' && url.endsWith('/projects/p1')) return Promise.resolve(jsonResponse(PROJECT))
          if (method === 'GET' && isIndividualCardRequest(url)) return Promise.resolve(jsonResponse(card))
          if (method === 'POST' && url.includes('/cards/card1/unblock')) {
            card = { ...card, blocked: false, block: null }
            return Promise.resolve(jsonResponse(card))
          }
          return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
        }),
      )

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Card bloqueado')
      await user.click(within(dialog).getByRole('button', { name: 'Desbloquear' }))
      const confirmDialog = (await screen.findByText('Desbloquear YK-1?')).closest('dialog') as HTMLElement
      await user.click(within(confirmDialog).getByRole('button', { name: 'Desbloquear' }))

      expect(await within(dialog).findByText('Não bloqueado')).toBeInTheDocument()
    })

    it('VIEWER visualiza o bloqueio sem poder gerenciar', async () => {
      const blockedCard = { ...CARD_BACKLOG_1, blocked: true, block: blockOf('Motivo válido para o teste.', 'Daniel Reis') }
      mockFetchRouter(boardAndProjectHandlers(BOARD, PROJECT, CARDS, { card1: blockedCard }))

      renderDetailPage('p1', 'VIEWER', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Card bloqueado')

      expect(within(dialog).queryByRole('button', { name: 'Desbloquear' })).not.toBeInTheDocument()
    })

    it('projeto arquivado mostra o bloqueio somente leitura', async () => {
      const blockedCard = { ...CARD_BACKLOG_1, blocked: true, block: blockOf('Motivo válido para o teste.', 'Daniel Reis') }
      mockFetchRouter(boardAndProjectHandlers(BOARD, ARCHIVED_PROJECT, CARDS, { card1: blockedCard }))

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Card bloqueado')

      expect(within(dialog).queryByRole('button', { name: 'Desbloquear' })).not.toBeInTheDocument()
    })
  })

  describe('Comentários', () => {
    // authValue() sempre usa id 'u1' para o usuário logado — 'u1' simula "comentário próprio",
    // qualquer outro id simula "comentário de outra pessoa".
    function commentOf(
      id: string,
      content: string | null,
      authorId: string,
      authorName: string,
      createdAt: string,
      updatedAt: string = createdAt,
      deleted = false,
    ) {
      return { id, content, author: { id: authorId, name: authorName }, createdAt, updatedAt, deleted }
    }

    function commentsPageOf(items: unknown[], page = 0, totalPages = 1, totalElements = items.length) {
      return { content: items, page, size: 20, totalElements, totalPages }
    }

    function isCommentsListRequest(url: string): boolean {
      return /\/cards\/card1\/comments(\?|$)/.test(url)
    }

    it('mostra estado vazio com composer para quem pode comentar', async () => {
      mockFetchRouter([
        ...boardAndProjectHandlers(),
        { match: (url, method) => method === 'GET' && isCommentsListRequest(url), respond: () => jsonResponse(commentsPageOf([])) },
      ])

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')

      expect(await within(dialog).findByText(/Nenhum comentário ainda/)).toBeInTheDocument()
      expect(within(dialog).getByLabelText('Adicionar comentário')).toBeInTheDocument()
    })

    it('VIEWER não vê o composer nem ações de gerenciamento', async () => {
      mockFetchRouter([
        ...boardAndProjectHandlers(),
        {
          match: (url, method) => method === 'GET' && isCommentsListRequest(url),
          respond: () =>
            jsonResponse(commentsPageOf([commentOf('cm1', 'Comentário existente.', 'u2', 'Maria', '2026-08-14T20:00:00Z')])),
        },
      ])

      renderDetailPage('p1', 'VIEWER', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Comentário existente.')

      expect(within(dialog).queryByLabelText('Adicionar comentário')).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument()
    })

    it('mostra comentários em ordem cronológica com autor e data', async () => {
      mockFetchRouter([
        ...boardAndProjectHandlers(),
        {
          match: (url, method) => method === 'GET' && isCommentsListRequest(url),
          respond: () =>
            jsonResponse(
              commentsPageOf([
                commentOf('cm1', 'Precisamos validar a regra.', 'u2', 'Maria', '2026-08-14T20:00:00Z'),
                commentOf('cm2', 'Regra confirmada.', 'u1', 'Ana', '2026-08-14T20:30:00Z'),
              ]),
            ),
        },
      ])

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Precisamos validar a regra.')

      const items = within(dialog).getAllByRole('listitem')
      expect(within(nth(items, 0)).getByText('Maria')).toBeInTheDocument()
      expect(within(nth(items, 0)).getByText('Precisamos validar a regra.')).toBeInTheDocument()
      expect(within(nth(items, 1)).getByText('Ana')).toBeInTheDocument()
      expect(within(nth(items, 1)).getByText('Regra confirmada.')).toBeInTheDocument()
    })

    it('permite criar um comentário, que aparece na conversa sem recarregar a página', async () => {
      const user = userEvent.setup()
      let comments: ReturnType<typeof commentOf>[] = []
      const created = commentOf('cm1', 'Comentário novo.', 'u1', 'Ana', '2026-08-14T21:00:00Z')
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
          const url = input.toString()
          const method = (init?.method ?? 'GET').toUpperCase()
          if (method === 'GET' && url.includes('/projects/p1/board')) return Promise.resolve(jsonResponse(BOARD))
          if (method === 'GET' && url.includes('/projects/p1/cards')) return Promise.resolve(jsonResponse(CARDS))
          if (method === 'GET' && url.endsWith('/projects/p1')) return Promise.resolve(jsonResponse(PROJECT))
          if (method === 'GET' && isIndividualCardRequest(url)) return Promise.resolve(jsonResponse(CARD_BACKLOG_1))
          if (method === 'GET' && isCommentsListRequest(url)) return Promise.resolve(jsonResponse(commentsPageOf(comments)))
          if (method === 'POST' && url.includes('/cards/card1/comments')) {
            comments = [created]
            return Promise.resolve(jsonResponse(created, 201))
          }
          return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
        }),
      )

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText(/Nenhum comentário ainda/)

      await user.type(within(dialog).getByLabelText('Adicionar comentário'), 'Comentário novo.')
      await user.click(within(dialog).getByRole('button', { name: 'Comentar' }))

      expect(await within(dialog).findByText('Comentário novo.')).toBeInTheDocument()
      expect(within(dialog).getByLabelText('Adicionar comentário')).toHaveValue('')
    })

    it('permite editar o próprio comentário e indica "editado"', async () => {
      const user = userEvent.setup()
      let comment = commentOf('cm1', 'Texto original.', 'u1', 'Ana', '2026-08-14T20:00:00Z')
      mockFetchRouter([
        ...boardAndProjectHandlers(),
        { match: (url, method) => method === 'GET' && isCommentsListRequest(url), respond: () => jsonResponse(commentsPageOf([comment])) },
        {
          match: (url, method) => method === 'PATCH' && url.includes('/comments/cm1'),
          respond: () => {
            comment = { ...comment, content: 'Texto corrigido.', updatedAt: '2026-08-14T20:05:00Z' }
            return jsonResponse(comment)
          },
        },
      ])

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Texto original.')

      // getByRole('Editar') sozinho seria ambíguo: o próprio Card também tem um botão "Editar".
      const commentItem = nth(within(dialog).getAllByRole('listitem'), 0)
      await user.click(within(commentItem).getByRole('button', { name: 'Editar' }))
      const editField = within(dialog).getByLabelText('Editar comentário de Ana')
      await user.clear(editField)
      await user.type(editField, 'Texto corrigido.')
      await user.click(within(dialog).getByRole('button', { name: 'Salvar' }))

      expect(await within(dialog).findByText('Texto corrigido.')).toBeInTheDocument()
      expect(within(dialog).getByText('editado')).toBeInTheDocument()
    })

    it('não mostra ação de editar em comentário de outro usuário', async () => {
      mockFetchRouter([
        ...boardAndProjectHandlers(),
        {
          match: (url, method) => method === 'GET' && isCommentsListRequest(url),
          respond: () =>
            jsonResponse(commentsPageOf([commentOf('cm1', 'Comentário de outra pessoa.', 'u2', 'Maria', '2026-08-14T20:00:00Z')])),
        },
      ])

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Comentário de outra pessoa.')

      // Escopado ao item do comentário — o Card em si tem seu próprio botão "Editar".
      const commentItem = nth(within(dialog).getAllByRole('listitem'), 0)
      expect(within(commentItem).queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    })

    it('permite remover o próprio comentário e mostra o placeholder preservando autor e posição', async () => {
      const user = userEvent.setup()
      mockFetchRouter([
        ...boardAndProjectHandlers(),
        {
          match: (url, method) => method === 'GET' && isCommentsListRequest(url),
          respond: () =>
            jsonResponse(
              commentsPageOf([
                commentOf('cm1', 'Vou remover este.', 'u1', 'Ana', '2026-08-14T20:00:00Z'),
                commentOf('cm2', 'Comentário seguinte.', 'u2', 'Maria', '2026-08-14T20:10:00Z'),
              ]),
            ),
        },
        {
          match: (url, method) => method === 'DELETE' && url.includes('/comments/cm1'),
          respond: () => ({ ok: true, status: 204, headers: new Headers(), json: () => Promise.resolve(undefined) }) as Response,
        },
      ])

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Vou remover este.')

      // ADMIN vê "Remover" nos dois comentários — escolhe o primeiro (o próprio, "cm1").
      const firstItem = nth(within(dialog).getAllByRole('listitem'), 0)
      await user.click(within(firstItem).getByRole('button', { name: 'Remover' }))
      const confirmDialog = (await screen.findByText('Remover este comentário?')).closest('dialog') as HTMLElement
      await user.click(within(confirmDialog).getByRole('button', { name: 'Remover' }))

      expect(await within(dialog).findByText('Comentário removido.')).toBeInTheDocument()
      expect(within(dialog).queryByText('Vou remover este.')).not.toBeInTheDocument()
      // Autor e posição cronológica permanecem — só o conteúdo some.
      const items = within(dialog).getAllByRole('listitem')
      expect(within(nth(items, 0)).getByText('Ana')).toBeInTheDocument()
      expect(within(nth(items, 1)).getByText('Comentário seguinte.')).toBeInTheDocument()
    })

    it('ADMIN pode remover comentário de outro usuário', async () => {
      const user = userEvent.setup()
      mockFetchRouter([
        ...boardAndProjectHandlers(),
        {
          match: (url, method) => method === 'GET' && isCommentsListRequest(url),
          respond: () => jsonResponse(commentsPageOf([commentOf('cm1', 'Comentário alheio.', 'u2', 'Maria', '2026-08-14T20:00:00Z')])),
        },
        {
          match: (url, method) => method === 'DELETE' && url.includes('/comments/cm1'),
          respond: () => ({ ok: true, status: 204, headers: new Headers(), json: () => Promise.resolve(undefined) }) as Response,
        },
      ])

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Comentário alheio.')
      await user.click(within(dialog).getByRole('button', { name: 'Remover' }))
      const confirmDialog = (await screen.findByText('Remover este comentário?')).closest('dialog') as HTMLElement
      await user.click(within(confirmDialog).getByRole('button', { name: 'Remover' }))

      expect(await within(dialog).findByText('Comentário removido.')).toBeInTheDocument()
    })

    it('mostra erro de carregamento com opção de tentar novamente', async () => {
      const user = userEvent.setup()
      let shouldFail = true
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
          const url = input.toString()
          const method = (init?.method ?? 'GET').toUpperCase()
          if (method === 'GET' && url.includes('/projects/p1/board')) return Promise.resolve(jsonResponse(BOARD))
          if (method === 'GET' && url.includes('/projects/p1/cards')) return Promise.resolve(jsonResponse(CARDS))
          if (method === 'GET' && url.endsWith('/projects/p1')) return Promise.resolve(jsonResponse(PROJECT))
          if (method === 'GET' && isIndividualCardRequest(url)) return Promise.resolve(jsonResponse(CARD_BACKLOG_1))
          if (method === 'GET' && isCommentsListRequest(url)) {
            if (shouldFail) {
              shouldFail = false
              return Promise.reject(new Error('Falha de rede simulada.'))
            }
            return Promise.resolve(jsonResponse(commentsPageOf([])))
          }
          if (method === 'GET' && url.includes('/cards/card1/history')) {
            return Promise.resolve(jsonResponse(pageOf([])))
          }
          return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
        }),
      )

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Não foi possível carregar os comentários.')

      await user.click(within(dialog).getByRole('button', { name: 'Tentar novamente' }))

      expect(await within(dialog).findByText(/Nenhum comentário ainda/)).toBeInTheDocument()
    })

    it('"Carregar mais" busca a próxima página e a acrescenta ao final, mantendo a ordem', async () => {
      const user = userEvent.setup()
      mockFetchRouter([
        ...boardAndProjectHandlers(),
        {
          match: (url, method) => method === 'GET' && isCommentsListRequest(url) && url.includes('page=1'),
          respond: () =>
            jsonResponse(commentsPageOf([commentOf('cm2', 'Comentário mais recente.', 'u2', 'Maria', '2026-08-14T20:10:00Z')], 1, 2, 2)),
        },
        {
          match: (url, method) => method === 'GET' && isCommentsListRequest(url),
          respond: () =>
            jsonResponse(commentsPageOf([commentOf('cm1', 'Comentário mais antigo.', 'u1', 'Ana', '2026-08-14T20:00:00Z')], 0, 2, 2)),
        },
      ])

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Comentário mais antigo.')

      await user.click(within(dialog).getByRole('button', { name: 'Carregar mais' }))

      await within(dialog).findByText('Comentário mais recente.')
      const items = within(dialog).getAllByRole('listitem')
      expect(within(nth(items, 0)).getByText('Comentário mais antigo.')).toBeInTheDocument()
      expect(within(nth(items, 1)).getByText('Comentário mais recente.')).toBeInTheDocument()
    })

    it('renderiza conteúdo com marcação HTML como texto literal, sem executar', async () => {
      const malicious = '<script>alert(1)</script>'
      mockFetchRouter([
        ...boardAndProjectHandlers(),
        {
          match: (url, method) => method === 'GET' && isCommentsListRequest(url),
          respond: () => jsonResponse(commentsPageOf([commentOf('cm1', malicious, 'u2', 'Maria', '2026-08-14T20:00:00Z')])),
        },
      ])

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')

      // Encontrar a string literal como texto (não como markup interpretado) já prova que nada usa
      // dangerouslySetInnerHTML — se fosse renderizado como HTML, não haveria esse texto para achar.
      expect(await within(dialog).findByText(malicious)).toBeInTheDocument()
    })
  })

  describe('Atividade', () => {
    function eventOf(id: string, eventType: string, actorName: string, metadata: Record<string, unknown>, createdAt: string) {
      return { id, eventType, actor: { id: 'u9', name: actorName }, metadata, createdAt }
    }

    function isHistoryListRequest(url: string): boolean {
      return /\/cards\/card1\/history(\?|$)/.test(url)
    }

    it('mostra estado vazio quando não há atividade', async () => {
      mockFetchRouter([
        ...boardAndProjectHandlers(),
        { match: (url, method) => method === 'GET' && isHistoryListRequest(url), respond: () => jsonResponse(pageOf([])) },
      ])

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')

      expect(await within(dialog).findByText('Nenhuma atividade registrada ainda.')).toBeInTheDocument()
    })

    it('mostra eventos formatados com data, mais recente primeiro', async () => {
      mockFetchRouter([
        ...boardAndProjectHandlers(),
        {
          match: (url, method) => method === 'GET' && isHistoryListRequest(url),
          respond: () =>
            jsonResponse(
              pageOf([
                eventOf('h2', 'CARD_BLOCKED', 'Ana', { reason: 'Aguardando API externa.' }, '2026-08-14T21:00:00Z'),
                eventOf('h1', 'CARD_CREATED', 'Ana', { key: 'YK-1' }, '2026-08-14T20:00:00Z'),
              ]),
            ),
        },
      ])

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText(/Ana bloqueou o card/)

      const items = within(dialog).getAllByRole('listitem').filter((item) => within(item).queryByText(/Ana/))
      expect(within(nth(items, 0)).getByText('Aguardando API externa.')).toBeInTheDocument()
      expect(within(nth(items, 1)).getByText('Ana criou o card YK-1.')).toBeInTheDocument()
    })

    it('usa fallback seguro para eventType desconhecido', async () => {
      mockFetchRouter([
        ...boardAndProjectHandlers(),
        {
          match: (url, method) => method === 'GET' && isHistoryListRequest(url),
          respond: () => jsonResponse(pageOf([eventOf('h1', 'AGENT_STARTED', 'Ana', {}, '2026-08-14T20:00:00Z')])),
        },
      ])

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')

      expect(await within(dialog).findByText('Atividade registrada.')).toBeInTheDocument()
    })

    it('mostra erro de carregamento com opção de tentar novamente', async () => {
      const user = userEvent.setup()
      let shouldFail = true
      mockFetchRouter([
        ...boardAndProjectHandlers(),
        { match: (url, method) => method === 'GET' && url.includes('/cards/card1/comments'), respond: () => jsonResponse(pageOf([])) },
        {
          match: (url, method) => method === 'GET' && isHistoryListRequest(url),
          respond: () => {
            if (shouldFail) {
              shouldFail = false
              return Promise.reject(new Error('Falha de rede simulada.'))
            }
            return jsonResponse(pageOf([]))
          },
        },
      ])

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Não foi possível carregar o histórico.')

      await user.click(within(dialog).getByRole('button', { name: 'Tentar novamente' }))

      expect(await within(dialog).findByText('Nenhuma atividade registrada ainda.')).toBeInTheDocument()
    })

    it('"Carregar mais atividades" busca a próxima página de eventos mais antigos', async () => {
      const user = userEvent.setup()
      mockFetchRouter([
        ...boardAndProjectHandlers(),
        {
          match: (url, method) => method === 'GET' && isHistoryListRequest(url) && url.includes('page=1'),
          respond: () =>
            jsonResponse({
              content: [eventOf('h1', 'CARD_CREATED', 'Ana', { key: 'YK-1' }, '2026-08-14T20:00:00Z')],
              page: 1,
              size: 1,
              totalElements: 2,
              totalPages: 2,
            }),
        },
        {
          match: (url, method) => method === 'GET' && isHistoryListRequest(url),
          respond: () =>
            jsonResponse({
              content: [eventOf('h2', 'CARD_BLOCKED', 'Ana', { reason: 'Motivo.' }, '2026-08-14T21:00:00Z')],
              page: 0,
              size: 1,
              totalElements: 2,
              totalPages: 2,
            }),
        },
      ])

      renderDetailPage('p1', 'ADMIN', '/projects/p1/cards/card1')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText(/Ana bloqueou o card/)

      await user.click(within(dialog).getByRole('button', { name: 'Carregar mais atividades' }))

      expect(await within(dialog).findByText('Ana criou o card YK-1.')).toBeInTheDocument()
    })
  })

  describe('Filtros e pesquisa do Kanban', () => {
    function handlersWithFilterableCards(filteredResult: unknown[]): FetchHandler[] {
      return [
        { match: (url, method) => method === 'GET' && url.includes('/projects/p1/board'), respond: () => jsonResponse(BOARD) },
        { match: (url, method) => method === 'GET' && url.endsWith('/projects/p1'), respond: () => jsonResponse(PROJECT) },
        { match: (url, method) => method === 'GET' && url.includes('/projects/p1/labels'), respond: () => jsonResponse([]) },
        { match: (url, method) => method === 'GET' && url.includes('/users'), respond: () => jsonResponse(pageOf([])) },
        {
          match: (url, method) => method === 'GET' && url.includes('/projects/p1/cards'),
          respond: (url) => {
            const hasFilter = new URL(url).search.length > 0
            return jsonResponse(hasFilter ? filteredResult : CARDS)
          },
        },
      ]
    }

    function filtersRegion() {
      return screen.getByRole('search', { name: 'Filtros do Kanban' })
    }

    it('busca por texto filtra os cards exibidos após o debounce', async () => {
      const user = userEvent.setup()
      mockFetchRouter(handlersWithFilterableCards([CARD_BACKLOG_2]))

      renderDetailPage('p1')
      await screen.findByText('Backlog')
      expect(screen.getByText('Primeiro card do backlog')).toBeInTheDocument()

      await user.type(within(filtersRegion()).getByLabelText('Buscar cards'), 'segundo')

      expect(await screen.findByText('Segundo card do backlog')).toBeInTheDocument()
      await waitFor(() => expect(screen.queryByText('Primeiro card do backlog')).not.toBeInTheDocument())
    })

    it('filtro de tipo mostra só os cards do tipo selecionado, exibe chip e desabilita o drag-and-drop', async () => {
      const user = userEvent.setup()
      mockFetchRouter(handlersWithFilterableCards([CARD_DOING]))

      renderDetailPage('p1')
      await screen.findByText('Backlog')

      await user.click(within(filtersRegion()).getByText('Tipo'))
      await user.click(within(filtersRegion()).getByRole('checkbox', { name: 'Bug' }))

      expect(await screen.findByText('Card em desenvolvimento')).toBeInTheDocument()
      await waitFor(() => expect(screen.queryByText('Primeiro card do backlog')).not.toBeInTheDocument())
      expect(within(within(filtersRegion()).getByRole('list', { name: 'Filtros ativos' })).getByText('Bug')).toBeInTheDocument()

      const cardButton = screen.getByRole('button', { name: /Card em desenvolvimento/ })
      expect(cardButton).not.toHaveAttribute('aria-roledescription')
    })

    it('"Limpar filtros" remove todos os filtros ativos e volta a mostrar todos os cards', async () => {
      const user = userEvent.setup()
      mockFetchRouter(handlersWithFilterableCards([CARD_DOING]))

      renderDetailPage('p1')
      await screen.findByText('Backlog')

      await user.click(within(filtersRegion()).getByText('Tipo'))
      await user.click(within(filtersRegion()).getByRole('checkbox', { name: 'Bug' }))
      await screen.findByText('Card em desenvolvimento')

      await user.click(within(filtersRegion()).getByRole('button', { name: 'Limpar filtros' }))

      expect(await screen.findByText('Primeiro card do backlog')).toBeInTheDocument()
      expect(within(filtersRegion()).queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument()
    })

    it('restaura filtros a partir da URL e ignora valores desconhecidos', async () => {
      mockFetchRouter(handlersWithFilterableCards([CARD_DOING]))

      renderDetailPage('p1', 'ADMIN', '/projects/p1?types=BUG,NAOEXISTE&blocked=true')
      await screen.findByText('Backlog')

      expect(await screen.findByText('Card em desenvolvimento')).toBeInTheDocument()
      await userEvent.setup().click(within(filtersRegion()).getByText('Tipo (1)'))
      expect(within(filtersRegion()).getByRole('checkbox', { name: 'Bug' })).toBeChecked()
      expect(within(filtersRegion()).getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument()
    })
  })
})

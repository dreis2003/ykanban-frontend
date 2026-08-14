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
    acceptanceCriteria: [] as unknown[],
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
const CARDS_BY_ID: Record<string, unknown> = { card1: CARD_BACKLOG_1, card2: CARD_BACKLOG_2, card3: CARD_DOING }

function authValue(role: 'ADMIN' | 'DEVELOPER' | 'VIEWER'): AuthContextValue {
  return {
    user: { id: 'u1', name: 'Ana', email: 'ana@ykanban.dev', role },
    isAuthenticated: true,
    isLoading: false,
    login: async () => undefined,
    logout: async () => undefined,
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
  cards: unknown = CARDS_PAGE,
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
        if (method === 'GET' && url.includes('/projects/p1/cards')) return Promise.resolve(jsonResponse(CARDS_PAGE))
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
        if (method === 'GET' && url.includes('/projects/p1/cards')) return Promise.resolve(jsonResponse(CARDS_PAGE))
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
    // Backlog tem 2 cards carregados (card1, card2) e agora wipLimit=5.
    expect(screen.getByText('2 / 5')).toBeInTheDocument()
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
            jsonResponse(updated ? pageOf([CARD_BACKLOG_2, UPDATED_CARD, CARD_DOING]) : CARDS_PAGE),
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
          if (method === 'GET' && url.includes('/projects/p1/cards')) return Promise.resolve(jsonResponse(CARDS_PAGE))
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
            return Promise.resolve(jsonResponse(pageOf([CARD_BACKLOG_2, cardWithCriteria, CARD_DOING])))
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
        ...boardAndProjectHandlers(BOARD, PROJECT, CARDS_PAGE, { card1: cardWithCriteria }),
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
          if (method === 'GET' && url.includes('/projects/p1/cards')) return Promise.resolve(jsonResponse(CARDS_PAGE))
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
          if (method === 'GET' && url.includes('/projects/p1/cards')) return Promise.resolve(jsonResponse(CARDS_PAGE))
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
      mockFetchRouter(boardAndProjectHandlers(BOARD, PROJECT, CARDS_PAGE, { card1: cardWithCriteria }))

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
      mockFetchRouter(boardAndProjectHandlers(BOARD, ARCHIVED_PROJECT, CARDS_PAGE, { card1: cardWithCriteria }))

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
        boardAndProjectHandlers(BOARD, PROJECT, pageOf([CARD_BACKLOG_2, cardWithCriteria, CARD_DOING]), {
          card1: cardWithCriteria,
        }),
      )

      renderDetailPage('p1')
      await screen.findByText('Backlog')

      expect(await screen.findByText('2/3')).toBeInTheDocument()
    })
  })
})

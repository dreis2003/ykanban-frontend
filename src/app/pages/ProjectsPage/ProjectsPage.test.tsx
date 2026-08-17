import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ProjectsPage } from '@/app/pages/ProjectsPage/ProjectsPage'
import { AuthContext, type AuthContextValue } from '@/features/auth/AuthContext'
import { authSession } from '@/shared/api/authSession'

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

function pageOf(items: unknown[]) {
  return { content: items, page: 0, size: 20, totalElements: items.length, totalPages: items.length > 0 ? 1 : 0 }
}

function summaryOf(total: number, active: number, archived: number) {
  return { total, active, archived }
}

function summaryHandler(summary: { total: number; active: number; archived: number }): FetchHandler {
  return {
    match: (url, method) => method === 'GET' && url.includes('/projects/summary'),
    respond: () => jsonResponse(summary),
  }
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

const PROJECT_A = {
  id: 'p1',
  code: 'YK',
  name: 'YKanban',
  description: 'Gerenciamento de projetos',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-08-12T00:00:00Z',
}

function authValue(role: 'ADMIN' | 'VIEWER'): AuthContextValue {
  return {
    user: { id: 'u1', name: 'Ana', email: 'ana@ykanban.dev' },
    activeTenant: { id: 't1', name: 'Yakuza Studio', slug: 'yakuza-studio', status: 'ACTIVE' },
    membershipRole: role,
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
  }
}

function renderProjectsPage(role: 'ADMIN' | 'VIEWER' = 'ADMIN') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue(role)}>
        <MemoryRouter>
          <ProjectsPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('ProjectsPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    authSession.setAccessToken(null)
  })

  it('mostra loading, depois a lista de projetos e o resumo', async () => {
    mockFetchRouter([
      summaryHandler(summaryOf(1, 1, 0)),
      { match: (url, method) => method === 'GET' && url.includes('/projects?'), respond: () => jsonResponse(pageOf([PROJECT_A])) },
    ])

    renderProjectsPage()

    expect(screen.getByText('Carregando projetos…')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('YKanban')).toBeInTheDocument())
    expect(screen.getByText('YK')).toBeInTheDocument()
    expect(screen.getByText('Ativo')).toBeInTheDocument()
    expect(screen.getByText('Total de Projetos')).toBeInTheDocument()
    expect(screen.getByText('Projetos Ativos')).toBeInTheDocument()
    expect(screen.getByText('Projetos Arquivados')).toBeInTheDocument()
  })

  it('mostra estado vazio com ação de criar quando não há nenhum projeto cadastrado', async () => {
    mockFetchRouter([
      summaryHandler(summaryOf(0, 0, 0)),
      { match: (url, method) => method === 'GET' && url.includes('/projects?'), respond: () => jsonResponse(pageOf([])) },
    ])

    renderProjectsPage()

    expect(await screen.findByText('Nenhum projeto cadastrado')).toBeInTheDocument()
    expect(screen.getByText('Crie o primeiro projeto da Yakuza Studio.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Criar projeto' })).toBeInTheDocument()
  })

  it('não mostra ação de criar no estado vazio para role VIEWER', async () => {
    mockFetchRouter([
      summaryHandler(summaryOf(0, 0, 0)),
      { match: (url, method) => method === 'GET' && url.includes('/projects?'), respond: () => jsonResponse(pageOf([])) },
    ])

    renderProjectsPage('VIEWER')

    expect(await screen.findByText('Nenhum projeto cadastrado')).toBeInTheDocument()
    expect(screen.getByText('Nenhum projeto está disponível no momento.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Criar projeto' })).not.toBeInTheDocument()
  })

  it('diferencia "sem resultados de pesquisa" de "nenhum projeto cadastrado"', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()
        if (url.includes('/projects/summary')) {
          return Promise.resolve(jsonResponse(summaryOf(1, 1, 0)))
        }
        if (url.includes('search=inexistente')) {
          return Promise.resolve(jsonResponse(pageOf([])))
        }
        return Promise.resolve(jsonResponse(pageOf([PROJECT_A])))
      }),
    )

    renderProjectsPage()
    await waitFor(() => expect(screen.getByText('YKanban')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText('Buscar projetos...'), 'inexistente')

    expect(await screen.findByText('Nenhum projeto encontrado para sua pesquisa.', {}, { timeout: 2000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument()
  })

  it('limpar filtros restaura a busca e o filtro padrão', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()
        if (url.includes('/projects/summary')) {
          return Promise.resolve(jsonResponse(summaryOf(1, 1, 0)))
        }
        if (url.includes('search=inexistente')) {
          return Promise.resolve(jsonResponse(pageOf([])))
        }
        return Promise.resolve(jsonResponse(pageOf([PROJECT_A])))
      }),
    )

    renderProjectsPage()
    await waitFor(() => expect(screen.getByText('YKanban')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText('Buscar projetos...'), 'inexistente')
    await screen.findByText('Nenhum projeto encontrado para sua pesquisa.', {}, { timeout: 2000 })

    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))

    await waitFor(() => expect(screen.getByText('YKanban')).toBeInTheDocument())
    expect(screen.getByPlaceholderText('Buscar projetos...')).toHaveValue('')
  })

  it('permite ordenar a lista de projetos', async () => {
    const user = userEvent.setup()
    const requestedUrls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()
        requestedUrls.push(url)
        if (url.includes('/projects/summary')) {
          return Promise.resolve(jsonResponse(summaryOf(1, 1, 0)))
        }
        return Promise.resolve(jsonResponse(pageOf([PROJECT_A])))
      }),
    )

    renderProjectsPage()
    await waitFor(() => expect(screen.getByText('YKanban')).toBeInTheDocument())

    await user.selectOptions(screen.getByLabelText('Ordenar por'), 'Mais recentes')

    await waitFor(() =>
      expect(requestedUrls.some((url) => url.includes('/projects?') && url.includes('sort=createdAt%2Cdesc'))).toBe(
        true,
      ),
    )
  })

  it('cria um projeto com sucesso', async () => {
    const user = userEvent.setup()
    let created = false
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString()
        const method = (init?.method ?? 'GET').toUpperCase()
        if (method === 'GET' && url.includes('/projects/summary')) {
          return Promise.resolve(jsonResponse(created ? summaryOf(1, 1, 0) : summaryOf(0, 0, 0)))
        }
        if (method === 'GET' && url.includes('/projects?')) {
          return Promise.resolve(jsonResponse(pageOf(created ? [PROJECT_A] : [])))
        }
        if (method === 'POST' && url.endsWith('/projects')) {
          created = true
          return Promise.resolve(jsonResponse(PROJECT_A, 201))
        }
        return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
      }),
    )

    renderProjectsPage()
    await screen.findByText('Nenhum projeto cadastrado')

    await user.click(screen.getByRole('button', { name: 'Novo Projeto' }))
    await user.type(screen.getByLabelText('Código'), 'YK')
    await user.type(screen.getByLabelText('Nome'), 'YKanban')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(screen.getByText('YKanban')).toBeInTheDocument())
  })

  it('mostra erro de código duplicado no formulário', async () => {
    const user = userEvent.setup()
    mockFetchRouter([
      summaryHandler(summaryOf(0, 0, 0)),
      { match: (url, method) => method === 'GET' && url.includes('/projects?'), respond: () => jsonResponse(pageOf([])) },
      {
        match: (url, method) => method === 'POST' && url.endsWith('/projects'),
        respond: () =>
          jsonResponse(
            { title: 'Código de projeto já existe', status: 409, detail: 'Já existe um projeto com o código YK.' },
            409,
          ),
      },
    ])

    renderProjectsPage()
    await screen.findByText('Nenhum projeto cadastrado')

    await user.click(screen.getByRole('button', { name: 'Novo Projeto' }))
    await user.type(screen.getByLabelText('Código'), 'YK')
    await user.type(screen.getByLabelText('Nome'), 'YKanban')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Já existe um projeto com o código YK.')).toBeInTheDocument()
  })

  it('edita nome e descrição de um projeto existente', async () => {
    const user = userEvent.setup()
    const updated = { ...PROJECT_A, name: 'YKanban Platform' }
    let wasUpdated = false
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString()
        const method = (init?.method ?? 'GET').toUpperCase()
        if (method === 'GET' && url.includes('/projects/summary')) {
          return Promise.resolve(jsonResponse(summaryOf(1, 1, 0)))
        }
        if (method === 'GET' && url.includes('/projects?')) {
          return Promise.resolve(jsonResponse(pageOf([wasUpdated ? updated : PROJECT_A])))
        }
        if (method === 'PUT' && url.includes('/projects/p1')) {
          wasUpdated = true
          return Promise.resolve(jsonResponse(updated))
        }
        return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
      }),
    )

    renderProjectsPage()
    await screen.findByText('YKanban')

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    const codeInput = screen.getByLabelText('Código')
    expect(codeInput).toBeDisabled()
    const nameInput = screen.getByLabelText('Nome')
    await user.clear(nameInput)
    await user.type(nameInput, 'YKanban Platform')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(screen.getByText('YKanban Platform')).toBeInTheDocument())
  })

  it('arquiva um projeto após confirmação e atualiza o resumo', async () => {
    const user = userEvent.setup()
    const archived = { ...PROJECT_A, status: 'ARCHIVED' }
    let wasArchived = false
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString()
        const method = (init?.method ?? 'GET').toUpperCase()
        if (method === 'GET' && url.includes('/projects/summary')) {
          return Promise.resolve(jsonResponse(wasArchived ? summaryOf(1, 0, 1) : summaryOf(1, 1, 0)))
        }
        if (method === 'GET' && url.includes('/projects?')) {
          return Promise.resolve(jsonResponse(pageOf(wasArchived ? [] : [PROJECT_A])))
        }
        if (method === 'POST' && url.includes('/projects/p1/archive')) {
          wasArchived = true
          return Promise.resolve(jsonResponse(archived))
        }
        return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
      }),
    )

    renderProjectsPage()
    await screen.findByText('YKanban')

    await user.click(screen.getByRole('button', { name: 'Arquivar' }))
    const dialog = await screen.findByText('Arquivar YKanban?')
    expect(dialog).toBeInTheDocument()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Arquivar' }))

    await waitFor(() => expect(screen.getByText('Nenhum projeto encontrado para sua pesquisa.')).toBeInTheDocument())
  })

  it('não mostra ações de gerenciamento para role VIEWER', async () => {
    mockFetchRouter([
      summaryHandler(summaryOf(1, 1, 0)),
      { match: (url, method) => method === 'GET' && url.includes('/projects?'), respond: () => jsonResponse(pageOf([PROJECT_A])) },
    ])

    renderProjectsPage('VIEWER')
    await screen.findByText('YKanban')

    expect(screen.queryByRole('button', { name: 'Novo Projeto' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Arquivar' })).not.toBeInTheDocument()
  })
})

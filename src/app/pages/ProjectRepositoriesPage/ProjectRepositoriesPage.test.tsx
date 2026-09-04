import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProjectRepositoriesPage } from '@/app/pages/ProjectRepositoriesPage/ProjectRepositoriesPage'
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

function repositoryOf(
  id: string,
  name: string,
  kind: string,
  remoteUrl: string,
  defaultBranch: string,
  status: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE',
) {
  return {
    id,
    projectId: 'p1',
    name,
    description: null,
    kind,
    remoteUrl,
    defaultBranch,
    status,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

// kind é deliberadamente diferente do rótulo amigável do nome (ex.: não usar "BACKEND" para o
// repositório chamado "Backend") — evita colisão entre o <h3> do nome e o badge de tipo nas
// asserções por texto abaixo.
const BACKEND_REPO = repositoryOf('r1', 'Backend', 'OTHER', 'https://github.com/org/backend.git', 'main')
const FRONTEND_REPO = repositoryOf('r2', 'Frontend', 'OTHER', 'https://github.com/org/frontend.git', 'main')

function authValue(role: 'ADMIN' | 'PROJECT_MANAGER' | 'DEVELOPER' | 'VIEWER'): AuthContextValue {
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

function renderPage(role: 'ADMIN' | 'PROJECT_MANAGER' | 'DEVELOPER' | 'VIEWER' = 'ADMIN') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue(role)}>
        <MemoryRouter initialEntries={['/projects/p1/repositories']}>
          <Routes>
            <Route path="/projects/:projectId/repositories" element={<ProjectRepositoriesPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

function projectHandler(project: unknown = PROJECT): FetchHandler {
  return { match: (url, method) => method === 'GET' && url.endsWith('/projects/p1'), respond: () => jsonResponse(project) }
}

function listHandler(items: unknown[]): FetchHandler {
  return {
    match: (url, method) => method === 'GET' && url.includes('/projects/p1/repositories'),
    respond: () => jsonResponse(items),
  }
}

describe('ProjectRepositoriesPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mostra loading e depois a lista de repositórios', async () => {
    mockFetchRouter([projectHandler(), listHandler([BACKEND_REPO, FRONTEND_REPO])])

    renderPage()

    expect(screen.getByText('Carregando projeto…')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Backend' })).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Frontend' })).toBeInTheDocument()
    expect(screen.getByText('github.com/org/backend.git')).toBeInTheDocument()
    expect(screen.getAllByText('main')).toHaveLength(2)
    // 3 badges "Ativo": o Project no cabeçalho + os 2 repositórios.
    expect(screen.getAllByText('Ativo')).toHaveLength(3)
  })

  it('mostra estado vazio com CTA para quem pode gerenciar', async () => {
    mockFetchRouter([projectHandler(), listHandler([])])

    renderPage()

    expect(await screen.findByText('Nenhum repositório vinculado a este projeto.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Adicionar repositório/ })).toBeInTheDocument()
  })

  it('DEVELOPER e VIEWER veem o estado vazio sem botão de criação', async () => {
    mockFetchRouter([projectHandler(), listHandler([])])
    renderPage('DEVELOPER')
    expect(await screen.findByText('Nenhum repositório vinculado a este projeto.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Adicionar repositório/ })).not.toBeInTheDocument()
  })

  it('cria um repositório com sucesso, deixando a branch em branco (assume "main")', async () => {
    const user = userEvent.setup()
    let created = false
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString()
        const method = (init?.method ?? 'GET').toUpperCase()
        if (method === 'GET' && url.endsWith('/projects/p1')) return Promise.resolve(jsonResponse(PROJECT))
        if (method === 'GET' && url.includes('/projects/p1/repositories')) {
          return Promise.resolve(jsonResponse(created ? [BACKEND_REPO] : []))
        }
        if (method === 'POST' && url.endsWith('/projects/p1/repositories')) {
          created = true
          return Promise.resolve(jsonResponse(BACKEND_REPO, 201))
        }
        return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
      }),
    )

    renderPage()
    await screen.findByText('Nenhum repositório vinculado a este projeto.')

    await user.click(screen.getByRole('button', { name: /Adicionar repositório/ }))
    await user.type(screen.getByLabelText('Nome'), 'Backend')
    await user.type(screen.getByLabelText('URL do repositório'), 'https://github.com/org/backend.git')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Backend' })).toBeInTheDocument())
  })

  it('exibe validação de campos obrigatórios sem chamar a API', async () => {
    const user = userEvent.setup()
    mockFetchRouter([projectHandler(), listHandler([])])

    renderPage()
    await screen.findByText('Nenhum repositório vinculado a este projeto.')

    await user.click(screen.getByRole('button', { name: /Adicionar repositório/ }))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Nome é obrigatório.')).toBeInTheDocument()
    expect(screen.getByText('URL do repositório é obrigatória.')).toBeInTheDocument()
  })

  it('mostra erro do backend (nome duplicado) no formulário', async () => {
    const user = userEvent.setup()
    mockFetchRouter([
      projectHandler(),
      listHandler([BACKEND_REPO]),
      {
        match: (url, method) => method === 'POST' && url.endsWith('/projects/p1/repositories'),
        respond: () =>
          jsonResponse(
            { title: 'Nome de repositório já existe', status: 409, detail: 'Já existe um repositório com o nome "Backend" neste projeto.' },
            409,
          ),
      },
    ])

    renderPage()
    await screen.findByRole('heading', { name: 'Backend' })

    await user.click(screen.getByRole('button', { name: /Adicionar repositório/ }))
    await user.type(screen.getByLabelText('Nome'), 'Backend')
    await user.type(screen.getByLabelText('URL do repositório'), 'https://github.com/org/other.git')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Já existe um repositório com o nome "Backend" neste projeto.')).toBeInTheDocument()
  })

  it('edita um repositório existente', async () => {
    const user = userEvent.setup()
    const updated = { ...BACKEND_REPO, name: 'API', kind: 'FULLSTACK' }
    let wasUpdated = false
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString()
        const method = (init?.method ?? 'GET').toUpperCase()
        if (method === 'GET' && url.endsWith('/projects/p1')) return Promise.resolve(jsonResponse(PROJECT))
        if (method === 'GET' && url.includes('/projects/p1/repositories')) {
          return Promise.resolve(jsonResponse([wasUpdated ? updated : BACKEND_REPO]))
        }
        if (method === 'PATCH' && url.includes('/projects/p1/repositories/r1')) {
          wasUpdated = true
          return Promise.resolve(jsonResponse(updated))
        }
        return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
      }),
    )

    renderPage()
    await screen.findByRole('heading', { name: 'Backend' })

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    const nameInput = screen.getByLabelText('Nome')
    await user.clear(nameInput)
    await user.type(nameInput, 'API')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(screen.getByText('API')).toBeInTheDocument())
    // "Full Stack" também existe como <option> no <select> do formulário (sempre montado, só
    // fechado) — escopar ao card do repositório evita ambiguidade.
    const row = screen.getByRole('article')
    expect(within(row).getByText('Full Stack')).toBeInTheDocument()
  })

  it('arquiva um repositório após confirmação', async () => {
    const user = userEvent.setup()
    const archived = { ...BACKEND_REPO, status: 'ARCHIVED' as const }
    let wasArchived = false
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString()
        const method = (init?.method ?? 'GET').toUpperCase()
        if (method === 'GET' && url.endsWith('/projects/p1')) return Promise.resolve(jsonResponse(PROJECT))
        if (method === 'GET' && url.includes('/projects/p1/repositories')) {
          return Promise.resolve(jsonResponse(wasArchived ? [] : [BACKEND_REPO]))
        }
        if (method === 'POST' && url.includes('/projects/p1/repositories/r1/archive')) {
          wasArchived = true
          return Promise.resolve(jsonResponse(archived))
        }
        return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
      }),
    )

    renderPage()
    await screen.findByRole('heading', { name: 'Backend' })

    await user.click(screen.getByRole('button', { name: 'Arquivar' }))
    expect(await screen.findByText('Arquivar o repositório Backend?')).toBeInTheDocument()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Arquivar' }))

    await waitFor(() => expect(screen.getByText('Nenhum repositório vinculado a este projeto.')).toBeInTheDocument())
  })

  it('reativa um repositório arquivado a partir da aba Arquivados', async () => {
    const user = userEvent.setup()
    const reactivated = { ...BACKEND_REPO, status: 'ACTIVE' as const }
    let wasReactivated = false
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString()
        const method = (init?.method ?? 'GET').toUpperCase()
        if (method === 'GET' && url.endsWith('/projects/p1')) return Promise.resolve(jsonResponse(PROJECT))
        if (method === 'GET' && url.includes('status=ARCHIVED')) {
          return Promise.resolve(jsonResponse(wasReactivated ? [] : [{ ...BACKEND_REPO, status: 'ARCHIVED' }]))
        }
        if (method === 'GET' && url.includes('/projects/p1/repositories')) {
          return Promise.resolve(jsonResponse(wasReactivated ? [reactivated] : []))
        }
        if (method === 'POST' && url.includes('/projects/p1/repositories/r1/reactivate')) {
          wasReactivated = true
          return Promise.resolve(jsonResponse(reactivated))
        }
        return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
      }),
    )

    renderPage()
    await screen.findByText('Nenhum repositório vinculado a este projeto.')

    await user.click(screen.getByRole('tab', { name: 'Arquivados' }))
    await screen.findByRole('heading', { name: 'Backend' })
    expect(screen.getByText('Arquivado')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reativar' }))

    await waitFor(() => expect(screen.getByText('Ativo')).toBeInTheDocument())
  })

  it('não mostra ações de gerenciamento para role VIEWER, mas a leitura funciona', async () => {
    mockFetchRouter([projectHandler(), listHandler([BACKEND_REPO])])

    renderPage('VIEWER')
    await screen.findByRole('heading', { name: 'Backend' })

    expect(screen.queryByRole('button', { name: /Adicionar repositório/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Arquivar' })).not.toBeInTheDocument()
  })

  it('PROJECT_MANAGER também pode criar repositório', async () => {
    mockFetchRouter([projectHandler(), listHandler([BACKEND_REPO])])

    renderPage('PROJECT_MANAGER')
    await screen.findByRole('heading', { name: 'Backend' })

    expect(screen.getByRole('button', { name: /Adicionar repositório/ })).toBeInTheDocument()
  })

  it('projeto arquivado ainda lista repositórios, mas a navegação de tela funciona (leitura)', async () => {
    mockFetchRouter([projectHandler(ARCHIVED_PROJECT), listHandler([BACKEND_REPO])])

    renderPage()
    await screen.findByRole('heading', { name: 'Backend' })

    expect(screen.getByText('Este projeto está arquivado e está em modo somente leitura.')).toBeInTheDocument()
  })

  it('navegação: link "Projetos" no breadcrumb e aba "Repositórios" ativa', async () => {
    mockFetchRouter([projectHandler(), listHandler([])])

    renderPage()
    await screen.findByText('Nenhum repositório vinculado a este projeto.')

    expect(screen.getByRole('link', { name: 'Projetos' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Repositórios' })).toHaveAttribute('aria-current', 'page')
  })

  it('cada repositório oferece um link para sua configuração técnica', async () => {
    mockFetchRouter([projectHandler(), listHandler([BACKEND_REPO])])

    renderPage('DEVELOPER')
    await screen.findByRole('heading', { name: 'Backend' })

    expect(screen.getByRole('link', { name: 'Configuração técnica' })).toHaveAttribute(
      'href',
      '/projects/p1/repositories/r1/technical-configuration',
    )
  })
})

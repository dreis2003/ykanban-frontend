import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProjectRepositoryTechnicalConfigurationPage } from '@/app/pages/ProjectRepositoryTechnicalConfigurationPage/ProjectRepositoryTechnicalConfigurationPage'
import { AuthContext, type AuthContextValue } from '@/features/auth/AuthContext'

interface FetchHandler {
  match: (url: string, method: string) => boolean
  respond: (url: string, body?: unknown) => Response | Promise<Response>
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
      const body = init?.body ? JSON.parse(init.body as string) : undefined
      return Promise.resolve(handler.respond(url, body))
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

const REPOSITORY = {
  id: 'r1',
  projectId: 'p1',
  name: 'Backend',
  description: null,
  kind: 'BACKEND',
  remoteUrl: 'https://github.com/org/backend.git',
  defaultBranch: 'main',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const ARCHIVED_REPOSITORY = { ...REPOSITORY, status: 'ARCHIVED' }

const NOT_CONFIGURED = {
  configured: false,
  repositoryId: 'r1',
  language: null,
  languageVersion: null,
  runtime: null,
  runtimeVersion: null,
  framework: null,
  frameworkVersion: null,
  buildTool: null,
  workingDirectory: null,
  commands: [],
  createdAt: null,
  updatedAt: null,
}

const CONFIGURED = {
  configured: true,
  repositoryId: 'r1',
  language: 'JAVA',
  languageVersion: '21',
  runtime: 'JVM',
  runtimeVersion: '21',
  framework: 'Spring Boot',
  frameworkVersion: '3',
  buildTool: 'MAVEN',
  workingDirectory: '.',
  commands: [
    { kind: 'TEST', command: './mvnw test', description: null },
    { kind: 'VERIFY', command: './mvnw verify', description: null },
  ],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

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
        <MemoryRouter initialEntries={['/projects/p1/repositories/r1/technical-configuration']}>
          <Routes>
            <Route
              path="/projects/:projectId/repositories/:repositoryId/technical-configuration"
              element={<ProjectRepositoryTechnicalConfigurationPage />}
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

function projectHandler(project: unknown = PROJECT): FetchHandler {
  return { match: (url, method) => method === 'GET' && url.endsWith('/projects/p1'), respond: () => jsonResponse(project) }
}

function repositoryHandler(repository: unknown = REPOSITORY): FetchHandler {
  return {
    match: (url, method) => method === 'GET' && url.endsWith('/projects/p1/repositories/r1'),
    respond: () => jsonResponse(repository),
  }
}

function configurationGetHandler(configuration: unknown): FetchHandler {
  return {
    match: (url, method) => method === 'GET' && url.endsWith('/technical-configuration'),
    respond: () => jsonResponse(configuration),
  }
}

describe('ProjectRepositoryTechnicalConfigurationPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mostra estado vazio com CTA para ADMIN quando não configurado', async () => {
    mockFetchRouter([projectHandler(), repositoryHandler(), configurationGetHandler(NOT_CONFIGURED)])

    renderPage('ADMIN')

    expect(await screen.findByText('Configuração técnica ainda não definida.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Configurar' })).toBeInTheDocument()
  })

  it('DEVELOPER e VIEWER veem o estado vazio sem CTA', async () => {
    mockFetchRouter([projectHandler(), repositoryHandler(), configurationGetHandler(NOT_CONFIGURED)])

    renderPage('DEVELOPER')
    expect(await screen.findByText('Configuração técnica ainda não definida.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Configurar' })).not.toBeInTheDocument()
  })

  it('ADMIN configura e salva com sucesso, enviando os commands informados', async () => {
    const handlers = [projectHandler(), repositoryHandler(), configurationGetHandler(NOT_CONFIGURED)]
    let putBody: unknown
    handlers.push({
      match: (url, method) => method === 'PUT' && url.endsWith('/technical-configuration'),
      respond: (_url, body) => {
        putBody = body
        return jsonResponse({ ...CONFIGURED, ...(body as object) })
      },
    })
    mockFetchRouter(handlers)
    const user = userEvent.setup()

    renderPage('ADMIN')
    await user.click(await screen.findByRole('button', { name: 'Configurar' }))

    await user.selectOptions(screen.getByLabelText('Linguagem'), 'JAVA')
    await user.selectOptions(screen.getByLabelText('Runtime'), 'JVM')
    await user.selectOptions(screen.getByLabelText('Ferramenta de build / Package manager'), 'MAVEN')
    await user.click(screen.getByRole('button', { name: 'Adicionar comando' }))
    await user.type(screen.getByLabelText('Comando'), './mvnw test')

    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(screen.getByText('Configuração técnica salva com sucesso.')).toBeInTheDocument())
    expect(putBody).toMatchObject({ language: 'JAVA', runtime: 'JVM', buildTool: 'MAVEN' })
    expect((putBody as { commands: unknown[] }).commands).toHaveLength(1)
  })

  it('PROJECT_MANAGER também pode salvar', async () => {
    mockFetchRouter([
      projectHandler(),
      repositoryHandler(),
      configurationGetHandler(CONFIGURED),
      {
        match: (url, method) => method === 'PUT' && url.endsWith('/technical-configuration'),
        respond: () => jsonResponse(CONFIGURED),
      },
    ])
    const user = userEvent.setup()

    renderPage('PROJECT_MANAGER')
    await screen.findByDisplayValue('Spring Boot')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(screen.getByText('Configuração técnica salva com sucesso.')).toBeInTheDocument())
  })

  it('carrega e exibe uma configuração já existente (edição)', async () => {
    mockFetchRouter([projectHandler(), repositoryHandler(), configurationGetHandler(CONFIGURED)])

    renderPage('ADMIN')

    await screen.findByDisplayValue('Spring Boot')
    expect(screen.getByLabelText('Versão da linguagem')).toHaveValue('21')
    expect(screen.getByLabelText('Versão do runtime')).toHaveValue('21')
    expect(screen.getByDisplayValue('./mvnw test')).toBeInTheDocument()
    expect(screen.getByDisplayValue('./mvnw verify')).toBeInTheDocument()
  })

  it('DEVELOPER vê a configuração existente em modo somente leitura', async () => {
    mockFetchRouter([projectHandler(), repositoryHandler(), configurationGetHandler(CONFIGURED)])

    renderPage('DEVELOPER')

    await screen.findByDisplayValue('Spring Boot')
    expect(screen.getByLabelText('Linguagem')).toBeDisabled()
    for (const commandInput of screen.getAllByLabelText('Comando')) {
      expect(commandInput).toBeDisabled()
    }
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument()
  })

  it('VIEWER vê a configuração existente em modo somente leitura', async () => {
    mockFetchRouter([projectHandler(), repositoryHandler(), configurationGetHandler(CONFIGURED)])

    renderPage('VIEWER')

    await screen.findByDisplayValue('Spring Boot')
    expect(screen.getByLabelText('Runtime')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument()
  })

  it('o seletor de tipo de um novo comando nunca oferece um CommandKind já usado', async () => {
    mockFetchRouter([projectHandler(), repositoryHandler(), configurationGetHandler(CONFIGURED)])
    const user = userEvent.setup()

    renderPage('ADMIN')
    await screen.findByDisplayValue('./mvnw test')
    await user.click(screen.getByRole('button', { name: 'Adicionar comando' }))

    const kindSelects = screen.getAllByLabelText('Tipo do comando')
    const newRowSelect = kindSelects.at(-1)
    if (!newRowSelect) throw new Error('linha de comando não encontrada')
    const optionValues = Array.from(newRowSelect.querySelectorAll('option')).map((o) => (o as HTMLOptionElement).value)
    expect(optionValues).not.toContain('TEST')
    expect(optionValues).not.toContain('VERIFY')
  })

  it('valida workingDirectory antes de enviar e não chama a API', async () => {
    const handlers = [projectHandler(), repositoryHandler(), configurationGetHandler(NOT_CONFIGURED)]
    let putCalled = false
    handlers.push({
      match: (url, method) => method === 'PUT' && url.endsWith('/technical-configuration'),
      respond: () => {
        putCalled = true
        return jsonResponse(CONFIGURED)
      },
    })
    mockFetchRouter(handlers)
    const user = userEvent.setup()

    renderPage('ADMIN')
    await user.click(await screen.findByRole('button', { name: 'Configurar' }))
    await user.clear(screen.getByLabelText('Diretório de trabalho'))
    await user.type(screen.getByLabelText('Diretório de trabalho'), '../etc')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(
      await screen.findByText('Diretório de trabalho não pode conter "..".'),
    ).toBeInTheDocument()
    expect(putCalled).toBe(false)
  })

  it('exibe o erro retornado pela API ao salvar', async () => {
    mockFetchRouter([
      projectHandler(),
      repositoryHandler(),
      configurationGetHandler(CONFIGURED),
      {
        match: (url, method) => method === 'PUT' && url.endsWith('/technical-configuration'),
        respond: () =>
          jsonResponse(
            { title: 'Erro', status: 400, detail: 'Diretório de trabalho contém caracteres inválidos.' },
            400,
          ),
      },
    ])
    const user = userEvent.setup()

    renderPage('ADMIN')
    await screen.findByDisplayValue('Spring Boot')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Diretório de trabalho contém caracteres inválidos.')).toBeInTheDocument()
  })

  it('repositório arquivado bloqueia edição mas mantém a leitura', async () => {
    mockFetchRouter([projectHandler(), repositoryHandler(ARCHIVED_REPOSITORY), configurationGetHandler(CONFIGURED)])

    renderPage('ADMIN')

    expect(await screen.findByText('Este repositório está arquivado e é somente leitura.')).toBeInTheDocument()
    await screen.findByDisplayValue('Spring Boot')
    expect(screen.getByLabelText('Linguagem')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument()
  })

  it('projeto arquivado bloqueia edição mas mantém a leitura', async () => {
    mockFetchRouter([projectHandler(ARCHIVED_PROJECT), repositoryHandler(), configurationGetHandler(CONFIGURED)])

    renderPage('ADMIN')

    expect(await screen.findByText('Este projeto está arquivado e está em modo somente leitura.')).toBeInTheDocument()
    await screen.findByDisplayValue('Spring Boot')
    expect(screen.getByLabelText('Linguagem')).toBeDisabled()
  })

  it('acesso direto pela URL (refresh) carrega a configuração corretamente', async () => {
    mockFetchRouter([projectHandler(), repositoryHandler(), configurationGetHandler(CONFIGURED)])

    renderPage('ADMIN')

    expect(await screen.findByRole('heading', { name: 'Configuração técnica' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Spring Boot')).toBeInTheDocument()
  })
})

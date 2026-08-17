import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PlatformPlanDetailPage } from '@/app/pages/PlatformPlanDetailPage/PlatformPlanDetailPage'
import { authSession } from '@/shared/api/authSession'

interface FetchHandler {
  match: (url: string, method: string) => boolean
  respond: () => Response | Promise<Response>
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' }),
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

const INCOMPLETE_PLAN = {
  id: 'p1',
  code: 'PROFESSIONAL',
  name: 'Professional',
  description: 'Plano intermediário',
  status: 'INACTIVE',
  displayOrder: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  features: [
    { key: 'GITHUB_INTEGRATION', enabled: false },
    { key: 'AI_AGENTS', enabled: false },
    { key: 'ADVANCED_ANALYTICS', enabled: false },
  ],
  limits: [
    { key: 'MAX_MEMBERS', configured: false, mode: null, value: null },
    { key: 'MAX_PROJECTS', configured: false, mode: null, value: null },
  ],
}

const COMPLETE_PLAN = {
  ...INCOMPLETE_PLAN,
  limits: [
    { key: 'MAX_MEMBERS', configured: true, mode: 'LIMITED', value: 10 },
    { key: 'MAX_PROJECTS', configured: true, mode: 'UNLIMITED', value: null },
  ],
}

function renderDetailPage(planId = 'p1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/platform/plans/${planId}`]}>
        <Routes>
          <Route path="/platform/plans/:planId" element={<PlatformPlanDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PlatformPlanDetailPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    authSession.setAccessToken(null)
  })

  it('mostra os dados do plano, incluindo features e limites não configurados', async () => {
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.endsWith('/platform/plans/p1'), respond: () => jsonResponse(INCOMPLETE_PLAN) },
    ])

    renderDetailPage()

    await waitFor(() => expect(screen.getByText('PROFESSIONAL')).toBeInTheDocument())
    expect(screen.getByText('Integração com GitHub')).toBeInTheDocument()
    expect(screen.getAllByText('Não configurado')).toHaveLength(2)
  })

  it('ativa uma Feature via toggle', async () => {
    const user = userEvent.setup()
    let enabled = false
    mockFetchRouter([
      {
        match: (url, method) => method === 'GET' && url.endsWith('/platform/plans/p1'),
        respond: () =>
          jsonResponse({
            ...INCOMPLETE_PLAN,
            features: INCOMPLETE_PLAN.features.map((f) => (f.key === 'GITHUB_INTEGRATION' ? { ...f, enabled } : f)),
          }),
      },
      {
        match: (url, method) => method === 'PUT' && url.includes('/features/GITHUB_INTEGRATION'),
        respond: () => {
          enabled = true
          return jsonResponse({
            ...INCOMPLETE_PLAN,
            features: INCOMPLETE_PLAN.features.map((f) => (f.key === 'GITHUB_INTEGRATION' ? { ...f, enabled: true } : f)),
          })
        },
      },
    ])

    renderDetailPage()
    await waitFor(() => expect(screen.getByText('PROFESSIONAL')).toBeInTheDocument())

    const toggle = screen.getByRole('switch', { name: 'Integração com GitHub' })
    expect(toggle).not.toBeChecked()
    await user.click(toggle)

    await waitFor(() => expect(screen.getByRole('switch', { name: 'Integração com GitHub' })).toBeChecked())
  })

  it('configura um limite como LIMITED com um valor', async () => {
    const user = userEvent.setup()
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.endsWith('/platform/plans/p1'), respond: () => jsonResponse(INCOMPLETE_PLAN) },
      {
        match: (url, method) => method === 'PUT' && url.includes('/limits/MAX_MEMBERS'),
        respond: () =>
          jsonResponse({
            ...INCOMPLETE_PLAN,
            limits: [
              { key: 'MAX_MEMBERS', configured: true, mode: 'LIMITED', value: 25 },
              { key: 'MAX_PROJECTS', configured: false, mode: null, value: null },
            ],
          }),
      },
    ])

    renderDetailPage()
    await waitFor(() => expect(screen.getByText('PROFESSIONAL')).toBeInTheDocument())

    const valueInput = screen.getByLabelText('Valor de Máximo de membros')
    await user.clear(valueInput)
    await user.type(valueInput, '25')
    const saveButtons = screen.getAllByRole('button', { name: 'Salvar' })
    await user.click(saveButtons[0]!)

    await waitFor(() => expect(screen.getAllByText('Não configurado')).toHaveLength(1))
  })

  it('recusa ativação de plano incompleto e mostra o erro do backend', async () => {
    const user = userEvent.setup()
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.endsWith('/platform/plans/p1'), respond: () => jsonResponse(INCOMPLETE_PLAN) },
      {
        match: (url, method) => method === 'POST' && url.endsWith('/activate'),
        respond: () =>
          jsonResponse(
            { title: 'Conflito', status: 409, detail: 'O plano não possui configuração para o(s) limite(s): MAX_MEMBERS, MAX_PROJECTS.' },
            409,
          ),
      },
    ])

    renderDetailPage()
    await waitFor(() => expect(screen.getByText('PROFESSIONAL')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Ativar plano' }))

    expect(
      await screen.findByText('O plano não possui configuração para o(s) limite(s): MAX_MEMBERS, MAX_PROJECTS.'),
    ).toBeInTheDocument()
  })

  it('ativa um plano completo com sucesso', async () => {
    const user = userEvent.setup()
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.endsWith('/platform/plans/p1'), respond: () => jsonResponse(COMPLETE_PLAN) },
      {
        match: (url, method) => method === 'POST' && url.endsWith('/activate'),
        respond: () => jsonResponse({ ...COMPLETE_PLAN, status: 'ACTIVE' }),
      },
    ])

    renderDetailPage()
    await waitFor(() => expect(screen.getByText('PROFESSIONAL')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Ativar plano' }))

    await waitFor(() => expect(screen.getByText('Ativo')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Desativar plano' })).toBeInTheDocument()
  })

  it('desativa um plano ativo após confirmação', async () => {
    const user = userEvent.setup()
    mockFetchRouter([
      {
        match: (url, method) => method === 'GET' && url.endsWith('/platform/plans/p1'),
        respond: () => jsonResponse({ ...COMPLETE_PLAN, status: 'ACTIVE' }),
      },
      {
        match: (url, method) => method === 'POST' && url.endsWith('/deactivate'),
        respond: () => jsonResponse({ ...COMPLETE_PLAN, status: 'INACTIVE' }),
      },
    ])

    renderDetailPage()
    await waitFor(() => expect(screen.getByText('PROFESSIONAL')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Desativar plano' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Desativar' }))

    await waitFor(() => expect(screen.getByText('Inativo')).toBeInTheDocument())
  })

  it('renomeia um plano com sucesso', async () => {
    const user = userEvent.setup()
    mockFetchRouter([
      { match: (url, method) => method === 'GET' && url.endsWith('/platform/plans/p1'), respond: () => jsonResponse(INCOMPLETE_PLAN) },
      {
        match: (url, method) => method === 'PATCH' && url.endsWith('/platform/plans/p1'),
        respond: () => jsonResponse({ ...INCOMPLETE_PLAN, name: 'Professional Plus' }),
      },
    ])

    renderDetailPage()
    await waitFor(() => expect(screen.getByText('PROFESSIONAL')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    const nameInput = screen.getByLabelText('Nome')
    await user.clear(nameInput)
    await user.type(nameInput, 'Professional Plus')
    await user.click(screen.getAllByRole('button', { name: 'Salvar' })[0]!)

    await waitFor(() => expect(screen.getByRole('heading', { name: /Professional Plus/ })).toBeInTheDocument())
  })
})

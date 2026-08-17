import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AppProviders } from '@/app/providers/AppProviders'
import { authSession } from '@/shared/api/authSession'

const AUTH_USER = { id: 'u1', name: 'Ana', email: 'ana@ykanban.dev' }
const TENANT = { id: 't1', name: 'Yakuza Studio', slug: 'yakuza-studio', status: 'ACTIVE' }

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
  } as Response
}

function mockAuthenticatedSession() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = input.toString()
      if (url.includes('/auth/refresh')) {
        return Promise.resolve(jsonResponse({ accessToken: 't', expiresIn: 900 }))
      }
      if (url.includes('/auth/me')) {
        return Promise.resolve(
          jsonResponse({ user: AUTH_USER, context: 'TENANT_ACCESS', tenant: TENANT, membership: { role: 'DEVELOPER', status: 'ACTIVE' } }),
        )
      }
      if (url.includes('/projects/summary')) {
        return Promise.resolve(jsonResponse({ total: 0, active: 0, archived: 0 }))
      }
      if (url.includes('/projects?')) {
        return Promise.resolve(
          jsonResponse({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
        )
      }
      return Promise.reject(new Error(`fetch inesperado: ${url}`))
    }),
  )
}

describe('AppProviders', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    authSession.setAccessToken(null)
  })

  it('restaura a sessão e redireciona para /projects, mostrando o layout autenticado', async () => {
    mockAuthenticatedSession()

    render(<AppProviders />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Projetos' })).toBeInTheDocument()
    })
    expect(screen.getByText('Yakuza Studio')).toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(await screen.findByText('Nenhum projeto cadastrado')).toBeInTheDocument()
  })

  it('redireciona para /login quando não há sessão restaurável', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ title: 'Sessão inválida ou expirada.', status: 401 }, 401)),
    )

    render(<AppProviders />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument()
    })
  })
})

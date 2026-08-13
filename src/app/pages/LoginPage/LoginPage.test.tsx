import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LoginPage } from '@/app/pages/LoginPage/LoginPage'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { authSession } from '@/shared/api/authSession'

const AUTH_USER = { id: 'u1', name: 'Ana', email: 'ana@ykanban.dev', role: 'DEVELOPER' }

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
  } as Response
}

function renderLoginPage() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>página inicial</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('LoginPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    authSession.setAccessToken(null)
  })

  it('renderiza os campos de e-mail e senha', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ title: 'x', status: 401 }, 401)))

    renderLoginPage()

    expect(screen.getByLabelText('E-mail')).toBeInTheDocument()
    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('faz login com sucesso e navega para a rota original', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(jsonResponse({ title: 'x', status: 401 }, 401))
        }
        if (url.includes('/auth/login')) {
          return Promise.resolve(jsonResponse({ accessToken: 't', expiresIn: 900, user: AUTH_USER }))
        }
        return Promise.reject(new Error(`fetch inesperado: ${url}`))
      }),
    )

    renderLoginPage()

    await user.type(screen.getByLabelText('E-mail'), 'ana@ykanban.dev')
    await user.type(screen.getByLabelText('Senha'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(screen.getByText('página inicial')).toBeInTheDocument())
  })

  it('mostra mensagem genérica quando as credenciais são inválidas', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(jsonResponse({ title: 'x', status: 401 }, 401))
        }
        if (url.includes('/auth/login')) {
          return Promise.resolve(jsonResponse({ title: 'E-mail ou senha inválidos.', status: 401 }, 401))
        }
        return Promise.reject(new Error(`fetch inesperado: ${url}`))
      }),
    )

    renderLoginPage()

    await user.type(screen.getByLabelText('E-mail'), 'ana@ykanban.dev')
    await user.type(screen.getByLabelText('Senha'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.')
    expect(screen.getByRole('button', { name: 'Entrar' })).not.toBeDisabled()
  })

  it('desabilita o botão de envio enquanto a requisição está pendente, evitando duplo submit', async () => {
    const user = userEvent.setup()
    let resolveLogin: (() => void) | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(jsonResponse({ title: 'x', status: 401 }, 401))
        }
        if (url.includes('/auth/login')) {
          return new Promise<Response>((resolve) => {
            resolveLogin = () => resolve(jsonResponse({ accessToken: 't', expiresIn: 900, user: AUTH_USER }))
          })
        }
        return Promise.reject(new Error(`fetch inesperado: ${url}`))
      }),
    )

    renderLoginPage()

    await user.type(screen.getByLabelText('E-mail'), 'ana@ykanban.dev')
    await user.type(screen.getByLabelText('Senha'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(screen.getByRole('button', { name: 'Entrando…' })).toBeDisabled()

    resolveLogin?.()
    await waitFor(() => expect(screen.getByText('página inicial')).toBeInTheDocument())
  })
})

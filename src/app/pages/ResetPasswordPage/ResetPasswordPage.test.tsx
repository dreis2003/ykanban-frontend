import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ResetPasswordPage } from '@/app/pages/ResetPasswordPage/ResetPasswordPage'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' }),
    json: () => Promise.resolve(body),
  } as Response
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/reset-password']}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={<div>Página de login</div>} />
        <Route path="/forgot-password" element={<div>Página de esqueci senha</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    window.location.hash = '#token=raw-reset-token'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.location.hash = ''
  })

  it('mostra link inválido quando não há token no fragment', async () => {
    window.location.hash = ''
    vi.stubGlobal('fetch', vi.fn())

    renderPage()

    expect(await screen.findByText('Este link de redefinição de senha não é mais válido.')).toBeInTheDocument()
  })

  it('valida o token e mostra o formulário de nova senha', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse({ valid: true, expiresAt: '2026-01-02T00:00:00Z' }))))

    renderPage()

    expect(await screen.findByText('Defina sua nova senha')).toBeInTheDocument()
    // O token some da barra de endereço assim que lido.
    expect(window.location.hash).toBe('')
  })

  it('mostra link inválido quando o token não é válido', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse({ valid: false, expiresAt: null }))))

    renderPage()

    expect(await screen.findByText('Este link de redefinição de senha não é mais válido.')).toBeInTheDocument()
  })

  it('redefine a senha e mostra confirmação de sucesso', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString()
        const method = (init?.method ?? 'GET').toUpperCase()
        if (url.includes('/public/password-resets/validate')) {
          return Promise.resolve(jsonResponse({ valid: true, expiresAt: '2026-01-02T00:00:00Z' }))
        }
        if (url.includes('/public/password-resets/confirm') && method === 'POST') {
          return Promise.resolve(jsonResponse(undefined, 200))
        }
        return Promise.reject(new Error(`fetch inesperado: ${method} ${url}`))
      }),
    )

    renderPage()
    await screen.findByText('Defina sua nova senha')

    await user.type(screen.getByLabelText('Nova senha'), 'N3wPassword!42')
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'N3wPassword!42')
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }))

    expect(await screen.findByText('Senha redefinida com sucesso.')).toBeInTheDocument()
  })

  it('rejeita senhas que não coincidem sem chamar a API de confirmação', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = input.toString()
        if (url.includes('/public/password-resets/validate')) {
          return Promise.resolve(jsonResponse({ valid: true, expiresAt: '2026-01-02T00:00:00Z' }))
        }
        return Promise.reject(new Error(`fetch inesperado: ${url}`))
      }),
    )

    renderPage()
    await screen.findByText('Defina sua nova senha')

    await user.type(screen.getByLabelText('Nova senha'), 'N3wPassword!42')
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'Different!42')
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }))

    expect(await screen.findByText('As senhas não coincidem.')).toBeInTheDocument()
  })
})

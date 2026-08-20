import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ForgotPasswordPage } from '@/app/pages/ForgotPasswordPage/ForgotPasswordPage'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': status >= 400 ? 'application/problem+json' : '' }),
    json: () => Promise.resolve(body),
  } as Response
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/login" element={<div>Página de login</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ForgotPasswordPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mostra sempre a mesma mensagem genérica após enviar, independentemente do resultado', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(undefined, 200))))

    renderPage()
    await user.type(screen.getByLabelText('E-mail'), 'alguem@empresa.com')
    await user.click(screen.getByRole('button', { name: 'Enviar link de redefinição' }))

    expect(await screen.findByText('Verifique seu e-mail')).toBeInTheDocument()
  })

  it('mostra a mesma mensagem genérica mesmo quando a chamada falha (anti-enumeração)', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network down'))))

    renderPage()
    await user.type(screen.getByLabelText('E-mail'), 'desconhecido@empresa.com')
    await user.click(screen.getByRole('button', { name: 'Enviar link de redefinição' }))

    expect(await screen.findByText('Verifique seu e-mail')).toBeInTheDocument()
  })
})

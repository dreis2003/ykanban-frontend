import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ConfirmEmailChangePage } from '@/app/pages/ConfirmEmailChangePage/ConfirmEmailChangePage'

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
    <MemoryRouter initialEntries={['/confirm-email-change']}>
      <Routes>
        <Route path="/confirm-email-change" element={<ConfirmEmailChangePage />} />
        <Route path="/login" element={<div>Página de login</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ConfirmEmailChangePage', () => {
  beforeEach(() => {
    window.location.hash = '#token=raw-email-change-token'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.location.hash = ''
  })

  it('mostra erro quando não há token no fragment', async () => {
    window.location.hash = ''
    vi.stubGlobal('fetch', vi.fn())

    renderPage()

    expect(await screen.findByText('Este link de confirmação não é mais válido.')).toBeInTheDocument()
  })

  it('confirma a troca de e-mail com sucesso', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(undefined, 200))))

    renderPage()

    expect(await screen.findByText('E-mail confirmado com sucesso.')).toBeInTheDocument()
    // O token some da barra de endereço assim que lido.
    expect(window.location.hash).toBe('')
  })

  it('mostra erro quando a confirmação falha', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(
            {
              type: 'https://ykanban.yakuzastudio.com/problems/invalid-email-change-request',
              title: 'Solicitação inválida',
              status: 409,
              detail: 'Este link de confirmação não é mais válido.',
            },
            409,
          ),
        ),
      ),
    )

    renderPage()

    expect(await screen.findByText('Este link de confirmação não é mais válido.')).toBeInTheDocument()
  })
})

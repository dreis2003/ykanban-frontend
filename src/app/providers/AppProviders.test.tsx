import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AppProviders } from '@/app/providers/AppProviders'

function mockFetchOnce(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      ...response,
    }),
  )
}

describe('AppProviders', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('inicializa a aplicação, renderiza o layout e confirma o backend conectado', async () => {
    mockFetchOnce({ json: () => Promise.resolve({ status: 'UP' }) })

    render(<AppProviders />)

    expect(screen.getByText('Yakuza Studio')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'YKanban' })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Backend conectado')).toBeInTheDocument()
    })
    expect(screen.getByText('UP')).toBeInTheDocument()
  })

  it('mostra estado de erro com opção de tentar novamente quando o backend está indisponível', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    render(<AppProviders />)

    const errorMessage = await screen.findByText('Backend indisponível')
    expect(errorMessage).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })
})

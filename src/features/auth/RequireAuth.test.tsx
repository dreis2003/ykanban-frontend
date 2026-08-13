import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { AuthContext, type AuthContextValue } from '@/features/auth/AuthContext'

const baseValue: AuthContextValue = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: async () => undefined,
  logout: async () => undefined,
}

function renderWithAuth(value: AuthContextValue) {
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/protegida']}>
        <Routes>
          <Route path="/login" element={<p>tela de login</p>} />
          <Route
            path="/protegida"
            element={
              <RequireAuth>
                <p>conteúdo protegido</p>
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('RequireAuth', () => {
  it('mostra estado de carregamento enquanto a sessão é verificada', () => {
    renderWithAuth({ ...baseValue, isLoading: true })

    expect(screen.getByText('Verificando sessão…')).toBeInTheDocument()
  })

  it('redireciona para /login quando não autenticado', () => {
    renderWithAuth({ ...baseValue, isAuthenticated: false })

    expect(screen.getByText('tela de login')).toBeInTheDocument()
  })

  it('renderiza o conteúdo protegido quando autenticado', () => {
    renderWithAuth({ ...baseValue, isAuthenticated: true })

    expect(screen.getByText('conteúdo protegido')).toBeInTheDocument()
  })
})

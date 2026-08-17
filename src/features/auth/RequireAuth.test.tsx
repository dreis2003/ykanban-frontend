import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { AuthContext, type AuthContextValue } from '@/features/auth/AuthContext'

const baseValue: AuthContextValue = {
  user: null,
  activeTenant: null,
  membershipRole: null,
  membershipStatus: null,
  authenticationContext: null,
  availableTenants: [],
  isAuthenticated: false,
  isTenantSelected: false,
  isLoading: false,
  login: async () => undefined,
  selectTenant: async () => undefined,
  logout: async () => undefined,
  refreshAvailableTenants: async () => undefined,
  refreshSession: async () => 'TENANT_SELECTION',
}

function renderWithAuth(value: AuthContextValue) {
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/protegida']}>
        <Routes>
          <Route path="/login" element={<p>tela de login</p>} />
          <Route path="/select-organization" element={<p>seleção de organização</p>} />
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

  it('redireciona para seleção de organização quando autenticado sem Tenant ativo', () => {
    renderWithAuth({ ...baseValue, isAuthenticated: true, isTenantSelected: false })

    expect(screen.getByText('seleção de organização')).toBeInTheDocument()
  })

  it('renderiza o conteúdo protegido quando autenticado com Tenant ativo', () => {
    renderWithAuth({ ...baseValue, isAuthenticated: true, isTenantSelected: true })

    expect(screen.getByText('conteúdo protegido')).toBeInTheDocument()
  })
})

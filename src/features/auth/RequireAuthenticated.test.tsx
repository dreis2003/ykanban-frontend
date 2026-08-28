import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '@/features/auth/AuthContext'
import { RequireAuthenticated } from '@/features/auth/RequireAuthenticated'

function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: { id: 'u1', name: 'Ana Admin', email: 'ana@ykanban.dev' },
    activeTenant: null,
    membershipRole: null,
    membershipStatus: null,
    authenticationContext: 'TENANT_SELECTION',
    platformRoles: [],
    availableTenants: [],
    isAuthenticated: true,
    isTenantSelected: false,
    isLoading: false,
    login: async () => undefined,
    selectTenant: async () => undefined,
    logout: async () => undefined,
    refreshAvailableTenants: async () => undefined,
    refreshSession: async () => 'TENANT_SELECTION',
    completeInvitationRegistration: async () => undefined,
    completeInvitationAcceptance: async () => undefined,
    ...overrides,
  }
}

function renderGuard(auth: AuthContextValue) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/select-organization']}>
        <Routes>
          <Route path="/login" element={<p>tela de login</p>} />
          <Route
            path="/select-organization"
            element={
              <RequireAuthenticated>
                <p>conteúdo autenticado</p>
              </RequireAuthenticated>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('RequireAuthenticated', () => {
  it('mostra loading enquanto a sessão é verificada', () => {
    renderGuard(authValue({ isLoading: true, isAuthenticated: false }))

    expect(screen.getByText('Verificando sessão…')).toBeInTheDocument()
  })

  it('redireciona para login quando não autenticado', () => {
    renderGuard(authValue({ isAuthenticated: false }))

    expect(screen.getByText('tela de login')).toBeInTheDocument()
    expect(screen.queryByText('conteúdo autenticado')).not.toBeInTheDocument()
  })

  it('renderiza o conteúdo para usuário autenticado mesmo sem Tenant ativo', () => {
    renderGuard(authValue({ isAuthenticated: true, isTenantSelected: false }))

    expect(screen.getByText('conteúdo autenticado')).toBeInTheDocument()
  })
})

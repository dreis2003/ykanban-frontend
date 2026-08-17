import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '@/features/auth/AuthContext'
import { RequirePlatformAdmin } from '@/features/auth/RequirePlatformAdmin'

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
      <MemoryRouter>
        <RequirePlatformAdmin>
          <p>conteúdo protegido</p>
        </RequirePlatformAdmin>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('RequirePlatformAdmin', () => {
  it('mostra loading enquanto a sessão é verificada', () => {
    renderGuard(authValue({ isLoading: true, isAuthenticated: false }))

    expect(screen.getByText('Verificando sessão…')).toBeInTheDocument()
  })

  it('redireciona para login quando não autenticado', () => {
    renderGuard(authValue({ isAuthenticated: false }))

    expect(screen.queryByText('conteúdo protegido')).not.toBeInTheDocument()
  })

  it('mostra acesso restrito para usuário autenticado sem PLATFORM_ADMIN', () => {
    renderGuard(authValue({ platformRoles: [] }))

    expect(screen.getByText('Acesso restrito')).toBeInTheDocument()
    expect(screen.queryByText('conteúdo protegido')).not.toBeInTheDocument()
  })

  it('renderiza o conteúdo para PLATFORM_ADMIN mesmo sem Tenant selecionado', () => {
    renderGuard(authValue({ platformRoles: ['PLATFORM_ADMIN'], isTenantSelected: false }))

    expect(screen.getByText('conteúdo protegido')).toBeInTheDocument()
  })
})

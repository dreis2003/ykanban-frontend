import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '@/features/auth/AuthContext'
import { RootRedirect } from '@/app/router/RootRedirect'

function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: { id: 'u1', name: 'Ana Admin', email: 'admin-hml@seudominio.com' },
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

function renderRoot(auth: AuthContextValue) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<p>tela de login</p>} />
          <Route path="/projects" element={<p>página de projetos</p>} />
          <Route path="/platform" element={<p>dashboard da plataforma</p>} />
          <Route path="/select-organization" element={<p>seleção de organização</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('RootRedirect', () => {
  it('mostra loading enquanto a sessão é verificada', () => {
    renderRoot(authValue({ isLoading: true, isAuthenticated: false }))
    expect(screen.getByText('Verificando sessão…')).toBeInTheDocument()
  })

  it('redireciona para /login quando não autenticado', () => {
    renderRoot(authValue({ isAuthenticated: false }))
    expect(screen.getByText('tela de login')).toBeInTheDocument()
  })

  it('redireciona para /projects quando autenticado com Tenant ativo', () => {
    renderRoot(
      authValue({
        isAuthenticated: true,
        isTenantSelected: true,
        activeTenant: { id: 't1', name: 'Tenant 1', slug: 't1', status: 'ACTIVE' },
      }),
    )
    expect(screen.getByText('página de projetos')).toBeInTheDocument()
  })

  it('redireciona para /platform quando autenticado como PLATFORM_ADMIN sem Tenant ativo', () => {
    renderRoot(
      authValue({
        isAuthenticated: true,
        isTenantSelected: false,
        platformRoles: ['PLATFORM_ADMIN'],
      }),
    )
    expect(screen.getByText('dashboard da plataforma')).toBeInTheDocument()
  })

  it('redireciona para /select-organization quando autenticado sem Tenant ativo e sem PLATFORM_ADMIN', () => {
    renderRoot(
      authValue({
        isAuthenticated: true,
        isTenantSelected: false,
        platformRoles: [],
      }),
    )
    expect(screen.getByText('seleção de organização')).toBeInTheDocument()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '@/features/auth/AuthContext'
import { SelectOrganizationPage } from '@/app/pages/SelectOrganizationPage/SelectOrganizationPage'
import type { AvailableTenant } from '@/features/auth/types'

const TENANT_1: AvailableTenant = {
  id: 't1',
  name: 'Empresa Alfa',
  slug: 'empresa-alfa',
  tenantStatus: 'ACTIVE',
  membershipRole: 'ADMIN',
}

const TENANT_2: AvailableTenant = {
  id: 't2',
  name: 'Empresa Beta',
  slug: 'empresa-beta',
  tenantStatus: 'ACTIVE',
  membershipRole: 'DEVELOPER',
}

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
    logout: vi.fn().mockResolvedValue(undefined),
    refreshAvailableTenants: async () => undefined,
    refreshSession: async () => 'TENANT_SELECTION',
    completeInvitationRegistration: async () => undefined,
    completeInvitationAcceptance: async () => undefined,
    ...overrides,
  }
}

function renderPage(auth: AuthContextValue) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/select-organization']}>
        <Routes>
          <Route path="/select-organization" element={<SelectOrganizationPage />} />
          <Route path="/projects" element={<p>página de projetos</p>} />
          <Route path="/platform" element={<p>dashboard da plataforma</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('SelectOrganizationPage', () => {
  it('renderiza lista de organizações quando há 2 ou mais disponíveis', () => {
    renderPage(authValue({ availableTenants: [TENANT_1, TENANT_2] }))

    expect(screen.getByText('Selecione uma organização')).toBeInTheDocument()
    expect(screen.getByText('Empresa Alfa')).toBeInTheDocument()
    expect(screen.getByText('Empresa Beta')).toBeInTheDocument()
  })

  it('permite selecionar uma organização e navega para /projects', async () => {
    const user = userEvent.setup()
    const selectTenant = vi.fn().mockResolvedValue(undefined)
    renderPage(authValue({ availableTenants: [TENANT_1], selectTenant }))

    await user.click(screen.getByRole('button', { name: /Empresa Alfa/ }))

    expect(selectTenant).toHaveBeenCalledWith('t1')
    expect(await screen.findByText('página de projetos')).toBeInTheDocument()
  })

  it('redireciona para /platform quando tem 0 organizações e é PLATFORM_ADMIN ativo', () => {
    renderPage(authValue({ availableTenants: [], platformRoles: ['PLATFORM_ADMIN'] }))

    expect(screen.getByText('dashboard da plataforma')).toBeInTheDocument()
    expect(screen.queryByText('Selecione uma organização')).not.toBeInTheDocument()
  })

  it('exibe mensagem apropriada e botão de sair quando tem 0 organizações e não é platform admin', async () => {
    const user = userEvent.setup()
    const logout = vi.fn().mockResolvedValue(undefined)
    renderPage(authValue({ availableTenants: [], platformRoles: [], logout }))

    expect(screen.getByText('Você ainda não possui uma organização.')).toBeInTheDocument()
    expect(screen.getByText('Você ainda não possui acesso a nenhuma organização.')).toBeInTheDocument()

    const logoutButton = screen.getByRole('button', { name: 'Sair' })
    expect(logoutButton).toBeInTheDocument()
    await user.click(logoutButton)
    expect(logout).toHaveBeenCalledTimes(1)
  })
})

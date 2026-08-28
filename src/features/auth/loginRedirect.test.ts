import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/app/router/routes'
import { resolvePostLoginRedirect } from '@/features/auth/loginRedirect'
import type { AvailableTenant } from '@/features/auth/types'

const TENANT_1: AvailableTenant = {
  id: 't1',
  name: 'Tenant 1',
  slug: 't1',
  tenantStatus: 'ACTIVE',
  membershipRole: 'ADMIN',
}

const TENANT_2: AvailableTenant = {
  id: 't2',
  name: 'Tenant 2',
  slug: 't2',
  tenantStatus: 'ACTIVE',
  membershipRole: 'DEVELOPER',
}

describe('resolvePostLoginRedirect', () => {
  it('Caso 1: redireciona para /projects quando usuário possui 1 tenant ativo', () => {
    const target = resolvePostLoginRedirect({
      isTenantSelected: true,
      availableTenants: [],
      platformRoles: [],
    })
    expect(target).toBe(ROUTES.projects)
  })

  it('Caso 1 com rota de destino (from): preserva a rota solicitada quando válida', () => {
    const target = resolvePostLoginRedirect({
      isTenantSelected: true,
      availableTenants: [],
      platformRoles: [],
      from: '/projects/p1/cards/c1',
    })
    expect(target).toBe('/projects/p1/cards/c1')
  })

  it('Caso 2: redireciona para /select-organization quando usuário possui 2 ou mais tenants', () => {
    const target = resolvePostLoginRedirect({
      isTenantSelected: false,
      availableTenants: [TENANT_1, TENANT_2],
      platformRoles: [],
    })
    expect(target).toBe(ROUTES.selectOrganization)
  })

  it('Caso 3: redireciona para /platform quando usuário possui 0 tenants e é PLATFORM_ADMIN ativo', () => {
    const target = resolvePostLoginRedirect({
      isTenantSelected: false,
      availableTenants: [],
      platformRoles: ['PLATFORM_ADMIN'],
    })
    expect(target).toBe(ROUTES.platformDashboard)
  })

  it('Caso 3 com rota de plataforma original: redireciona para a sub-rota de /platform solicitada', () => {
    const target = resolvePostLoginRedirect({
      isTenantSelected: false,
      availableTenants: [],
      platformRoles: ['PLATFORM_ADMIN'],
      from: '/platform/tenants',
    })
    expect(target).toBe('/platform/tenants')
  })

  it('Caso 4: redireciona para /select-organization quando usuário possui 0 tenants e NÃO é platform admin', () => {
    const target = resolvePostLoginRedirect({
      isTenantSelected: false,
      availableTenants: [],
      platformRoles: [],
    })
    expect(target).toBe(ROUTES.selectOrganization)
  })

  it('redireciona para /account quando o destino era /account independente do tipo de usuário', () => {
    const target = resolvePostLoginRedirect({
      isTenantSelected: false,
      availableTenants: [],
      platformRoles: [],
      from: ROUTES.account,
    })
    expect(target).toBe(ROUTES.account)
  })
})

import { ROUTES } from '@/app/router/routes'
import type { AvailableTenant } from '@/features/auth/types'

export interface ResolvePostLoginRedirectParams {
  isTenantSelected: boolean
  availableTenants: AvailableTenant[]
  platformRoles: string[]
  from?: string | null | undefined
}

/**
 * Determina a rota de destino após o login ou autenticação:
 * - Caso 1 (1 Tenant ativo): vai para a rota original ou /projects.
 * - Caso 2 (2+ Tenants): vai para /select-organization.
 * - Caso 3 (0 Tenants + PLATFORM_ADMIN ativo): vai para a rota original de /platform ou /platform.
 * - Caso 4 (0 Tenants e sem PlatformAuthority): vai para /select-organization (estado sem organização).
 */
export function resolvePostLoginRedirect({
  isTenantSelected,
  availableTenants,
  platformRoles,
  from,
}: ResolvePostLoginRedirectParams): string {
  const isPlatformAdmin = platformRoles.includes('PLATFORM_ADMIN')

  // Se o usuário tentou acessar uma rota de plataforma e possui autoridade ativa:
  if (from?.startsWith('/platform') && isPlatformAdmin) {
    return from
  }

  // Se o usuário tentou acessar "Minha Conta":
  if (from === ROUTES.account) {
    return from
  }

  // Caso 1: Usuário possui exatamente 1 TenantMembership ACTIVE (Tenant já selecionado)
  if (isTenantSelected) {
    if (
      from &&
      !from.startsWith('/login') &&
      !from.startsWith('/select-organization') &&
      !from.startsWith('/platform')
    ) {
      return from
    }
    return ROUTES.projects
  }

  // Caso 3: 0 TenantMemberships + PLATFORM_ADMIN ACTIVE
  if (availableTenants.length === 0 && isPlatformAdmin) {
    return ROUTES.platformDashboard
  }

  // Caso 2 (2+ Tenants) ou Caso 4 (0 Tenants sem autoridade de plataforma)
  return ROUTES.selectOrganization
}

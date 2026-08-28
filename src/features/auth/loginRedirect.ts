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
 * - Caso 1 (Tenant ativo / TENANT_ACCESS): vai para a rota original ou /projects.
 * - Caso 2 (Platform Admin sem Tenant ativo): vai para a rota original de /platform ou /platform.
 * - Caso 3 (Minha Conta): vai para /account.
 * - Caso 4 (Sem Tenant ativo e não é Platform Admin): vai para /select-organization.
 */
export function resolvePostLoginRedirect({
  isTenantSelected,
  availableTenants: _availableTenants,
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

  // Caso 1: Usuário possui Tenant ativo (TENANT_ACCESS)
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

  // Caso 2: PLATFORM_ADMIN ativo sem Tenant ativo
  if (isPlatformAdmin) {
    return ROUTES.platformDashboard
  }

  // Caso 4: Sem Tenant ativo e sem autoridade de plataforma (2+ Tenants para escolha ou 0 Tenants)
  return ROUTES.selectOrganization
}

import { createContext, useContext } from 'react'
import type {
  AuthenticationContext,
  AuthUser,
  AvailableTenant,
  MembershipRole,
  MembershipStatus,
  Tenant,
} from '@/features/auth/types'

export interface AuthContextValue {
  user: AuthUser | null
  activeTenant: Tenant | null
  membershipRole: MembershipRole | null
  membershipStatus: MembershipStatus | null
  authenticationContext: AuthenticationContext | null
  availableTenants: AvailableTenant[]
  isAuthenticated: boolean
  /** {@code true} quando existe um Tenant ativo — endpoints de negócio só funcionam nesse estado. */
  isTenantSelected: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  selectTenant: (tenantId: string) => Promise<void>
  logout: () => Promise<void>
  refreshAvailableTenants: () => Promise<void>
  /** Reconsulta /auth/me com o access token atual — Role/Membership nunca vêm do JWT (ver ADR
   * 0020), então uma mutação de Membership feita pelo próprio usuário (ex.: autopromoção) só
   * reflete na UI depois desta chamada. Retorna o `context` resultante para o chamador decidir se
   * precisa redirecionar (ex.: `TENANT_SELECTION` após o usuário remover/desativar a si mesmo). */
  refreshSession: () => Promise<AuthenticationContext>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth precisa ser usado dentro de um AuthProvider.')
  }
  return context
}

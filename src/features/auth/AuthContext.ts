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
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth precisa ser usado dentro de um AuthProvider.')
  }
  return context
}

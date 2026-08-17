import { createContext, useContext } from 'react'
import type {
  AuthenticationContext,
  AuthUser,
  AvailableTenant,
  LoginResponse,
  MembershipRole,
  MembershipStatus,
  Tenant,
  TenantSelectionResponse,
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
  /** Aplica a sessão retornada por `POST /public/invitations/{token}/register` (ver ADR 0022) —
   * a chamada à API é feita pela feature de convites; este método só assume o resultado. */
  completeInvitationRegistration: (result: LoginResponse) => Promise<void>
  /** Aplica a sessão retornada por `POST /invitations/{token}/accept` (ver ADR 0022) — mesma
   * observação de `completeInvitationRegistration`. */
  completeInvitationAcceptance: (result: TenantSelectionResponse) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth precisa ser usado dentro de um AuthProvider.')
  }
  return context
}

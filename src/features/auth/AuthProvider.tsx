import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi } from '@/features/auth/api/authApi'
import { AuthContext } from '@/features/auth/AuthContext'
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
import { authSession } from '@/shared/api/authSession'

type Status = 'loading' | 'authenticated' | 'unauthenticated'

interface Props {
  children: ReactNode
}

interface SessionState {
  user: AuthUser | null
  activeTenant: Tenant | null
  membershipRole: MembershipRole | null
  membershipStatus: MembershipStatus | null
  authenticationContext: AuthenticationContext | null
}

const EMPTY_SESSION: SessionState = {
  user: null,
  activeTenant: null,
  membershipRole: null,
  membershipStatus: null,
  authenticationContext: null,
}

/**
 * Restaura a sessão ao carregar a aplicação via /auth/refresh (cookie HttpOnly) — sem isso, todo
 * reload da SPA cairia em /login mesmo com uma sessão ainda válida no backend. Também é a única
 * fonte de verdade do Tenant ativo/Role — nenhum componente lê isso de outro lugar (ver ADR 0020).
 */
export function AuthProvider({ children }: Props) {
  const [session, setSession] = useState<SessionState>(EMPTY_SESSION)
  const [availableTenants, setAvailableTenants] = useState<AvailableTenant[]>([])
  const [platformRoles, setPlatformRoles] = useState<string[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const queryClient = useQueryClient()

  /**
   * Ponto único de "sair do contexto Tenant atual" — troca de Tenant, logout e expiração de
   * sessão passam todos por aqui. Cancela requests em voo e limpa TODO o cache do TanStack Query
   * (ver ADR 0020, itens 70-73): sem isso, uma resposta tardia do Tenant anterior poderia
   * sobrescrever dados do novo Tenant mesmo com query keys idênticas entre páginas.
   */
  const resetQueryCache = useCallback(async () => {
    await queryClient.cancelQueries()
    queryClient.clear()
  }, [queryClient])

  const clearSession = useCallback(() => {
    authSession.setAccessToken(null)
    setSession(EMPTY_SESSION)
    setAvailableTenants([])
    setPlatformRoles([])
    setStatus('unauthenticated')
    void resetQueryCache()
  }, [resetQueryCache])

  useEffect(() => {
    authSession.onUnauthorized(clearSession)
    return () => authSession.onUnauthorized(null)
  }, [clearSession])

  const fetchAvailableTenants = useCallback(async () => {
    const tenants = await authApi.availableTenants()
    setAvailableTenants(tenants)
  }, [])

  const applyMe = useCallback(
    async (accessToken: string) => {
      authSession.setAccessToken(accessToken)
      const me = await authApi.me()
      let tenants: AvailableTenant[] = []
      if (me.context === 'TENANT_SELECTION') {
        try {
          tenants = await authApi.availableTenants()
        } catch {
          tenants = []
        }
      }
      setAvailableTenants(tenants)
      setPlatformRoles(me.platform?.roles ?? [])
      setSession({
        user: me.user,
        activeTenant: me.tenant,
        membershipRole: me.membership?.role ?? null,
        membershipStatus: me.membership?.status ?? null,
        authenticationContext: me.context,
      })
      setStatus('authenticated')
    },
    [],
  )

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      try {
        const refreshed = await authApi.refresh()
        if (cancelled) {
          return
        }
        await applyMe(refreshed.accessToken)
      } catch {
        if (!cancelled) {
          clearSession()
        }
      }
    }

    void restoreSession()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda só na montagem, por design.
  }, [])

  /** Corpo comum de `login` e `completeInvitationRegistration` — as duas APIs devolvem exatamente
   * a mesma forma (`LoginResponse`), já que registrar-se por convite também autentica na hora
   * (ver ADR 0022, item 80). */
  const applyLoginResponse = useCallback(
    async (result: LoginResponse) => {
      authSession.setAccessToken(result.accessToken)
      let tenants: AvailableTenant[] = []
      if (result.context === 'TENANT_SELECTION') {
        try {
          tenants = await authApi.availableTenants()
        } catch {
          tenants = []
        }
      }
      setAvailableTenants(tenants)
      setPlatformRoles(result.platform?.roles ?? [])
      setSession({
        user: result.user,
        activeTenant: result.tenant,
        membershipRole: result.membershipRole,
        membershipStatus: result.tenant ? 'ACTIVE' : null,
        authenticationContext: result.context,
      })
      await resetQueryCache()
      setStatus('authenticated')
    },
    [resetQueryCache],
  )

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authApi.login(email, password)
      await applyLoginResponse(result)
    },
    [applyLoginResponse],
  )

  /** Usado pela tela pública de convite após `POST /public/invitations/{token}/register` (ver
   * ADR 0022) — a chamada à API fica na feature de convites, não aqui (evita acoplar
   * `features/auth` a `features/invitations`); este método só aplica o resultado já obtido. */
  const completeInvitationRegistration = useCallback(
    async (result: LoginResponse) => {
      await applyLoginResponse(result)
    },
    [applyLoginResponse],
  )

  /** Corpo comum de `selectTenant` e `completeInvitationAcceptance` — ambos tornam um Tenant
   * ativo via a mesma forma de resposta (`TenantSelectionResponse`); aceitar um convite com uma
   * conta já existente reaproveita exatamente o mecanismo de troca de Tenant (ver ADR 0022, item
   * 81 — o backend também reaproveita `TenantSelectionService#selectTenant`). */
  const applyTenantSelectionResponse = useCallback(
    async (result: TenantSelectionResponse) => {
      authSession.setAccessToken(result.accessToken)
      setSession((previous) => ({
        ...previous,
        activeTenant: result.tenant,
        membershipRole: result.membershipRole,
        membershipStatus: 'ACTIVE',
        authenticationContext: 'TENANT_ACCESS',
      }))
      setAvailableTenants([])
      await resetQueryCache()
    },
    [resetQueryCache],
  )

  const selectTenant = useCallback(
    async (tenantId: string) => {
      const result = await authApi.selectTenant(tenantId)
      await applyTenantSelectionResponse(result)
    },
    [applyTenantSelectionResponse],
  )

  /** Usado pela tela pública de convite após `POST /invitations/{token}/accept` (usuário já
   * autenticado, ver ADR 0022) — mesma justificativa de `completeInvitationRegistration`: a
   * chamada à API fica na feature de convites. */
  const completeInvitationAcceptance = useCallback(
    async (result: TenantSelectionResponse) => {
      await applyTenantSelectionResponse(result)
    },
    [applyTenantSelectionResponse],
  )

  const refreshSession = useCallback(async () => {
    const me = await authApi.me()
    let tenants: AvailableTenant[] = []
    if (me.context === 'TENANT_SELECTION') {
      try {
        tenants = await authApi.availableTenants()
      } catch {
        tenants = []
      }
    }
    setAvailableTenants(tenants)
    setPlatformRoles(me.platform?.roles ?? [])
    setSession({
      user: me.user,
      activeTenant: me.tenant,
      membershipRole: me.membership?.role ?? null,
      membershipStatus: me.membership?.status ?? null,
      authenticationContext: me.context,
    })
    return me.context
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Best-effort: a sessão local é limpa abaixo independentemente da chamada ao backend.
    } finally {
      clearSession()
    }
  }, [clearSession])

  const value = useMemo(
    () => ({
      user: session.user,
      activeTenant: session.activeTenant,
      membershipRole: session.membershipRole,
      membershipStatus: session.membershipStatus,
      authenticationContext: session.authenticationContext,
      platformRoles,
      availableTenants,
      isAuthenticated: status === 'authenticated',
      isTenantSelected: status === 'authenticated' && session.activeTenant !== null,
      isLoading: status === 'loading',
      login,
      selectTenant,
      logout,
      refreshAvailableTenants: fetchAvailableTenants,
      refreshSession,
      completeInvitationRegistration,
      completeInvitationAcceptance,
    }),
    [
      session,
      availableTenants,
      platformRoles,
      status,
      login,
      selectTenant,
      logout,
      fetchAvailableTenants,
      refreshSession,
      completeInvitationRegistration,
      completeInvitationAcceptance,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

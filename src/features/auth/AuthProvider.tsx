import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi } from '@/features/auth/api/authApi'
import { AuthContext } from '@/features/auth/AuthContext'
import type { AuthUser } from '@/features/auth/types'
import { authSession } from '@/shared/api/authSession'

type Status = 'loading' | 'authenticated' | 'unauthenticated'

interface Props {
  children: ReactNode
}

/**
 * Restaura a sessão ao carregar a aplicação via /auth/refresh (cookie HttpOnly) — sem isso, todo
 * reload da SPA cairia em /login mesmo com uma sessão ainda válida no backend.
 */
export function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<Status>('loading')

  const clearSession = useCallback(() => {
    authSession.setAccessToken(null)
    setUser(null)
    setStatus('unauthenticated')
  }, [])

  useEffect(() => {
    authSession.onUnauthorized(clearSession)
    return () => authSession.onUnauthorized(null)
  }, [clearSession])

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      try {
        const refreshed = await authApi.refresh()
        authSession.setAccessToken(refreshed.accessToken)
        const me = await authApi.me()
        if (!cancelled) {
          setUser(me)
          setStatus('authenticated')
        }
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
  }, [clearSession])

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password)
    authSession.setAccessToken(result.accessToken)
    setUser(result.user)
    setStatus('authenticated')
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
      user,
      isAuthenticated: status === 'authenticated',
      isLoading: status === 'loading',
      login,
      logout,
    }),
    [user, status, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

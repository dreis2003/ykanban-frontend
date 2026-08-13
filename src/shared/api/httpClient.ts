import { env } from '@/app/config/env'
import { ApiError } from '@/shared/api/apiError'
import { authSession } from '@/shared/api/authSession'
import { isProblemDetails } from '@/shared/types/problemDetails'

interface RequestOptions {
  signal?: AbortSignal
  /** login/refresh não devem tentar se auto-renovar em um 401 — evitaria um loop infinito. */
  skipAuthRetry?: boolean
}

async function parseErrorResponse(response: Response): Promise<ApiError> {
  const contentType = response.headers.get('content-type') ?? ''
  if (
    contentType.includes('application/problem+json') ||
    contentType.includes('application/json')
  ) {
    const body: unknown = await response.json().catch(() => undefined)
    if (isProblemDetails(body)) {
      return new ApiError(body.title, { status: response.status, problem: body })
    }
  }
  return new ApiError(`Requisição falhou com status ${response.status}`, {
    status: response.status,
  })
}

async function rawFetch(path: string, init: RequestInit): Promise<Response> {
  const token = authSession.getAccessToken()
  try {
    return await fetch(`${env.apiBaseUrl}${path}`, {
      ...init,
      // Necessário para o cookie HttpOnly do refresh token trafegar em /auth/refresh e /auth/logout.
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError('Não foi possível conectar ao backend. Verifique se ele está em execução.')
  }
}

let refreshPromise: Promise<boolean> | null = null

/**
 * Deduplica chamadas concorrentes de refresh: se várias requisições recebem 401 ao mesmo tempo,
 * todas aguardam o mesmo refresh em vez de disparar um por chamada.
 */
function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

async function doRefresh(): Promise<boolean> {
  try {
    const response = await rawFetch('/auth/refresh', { method: 'POST' })
    if (!response.ok) {
      return false
    }
    const body = (await response.json()) as { accessToken: string }
    authSession.setAccessToken(body.accessToken)
    return true
  } catch {
    return false
  }
}

async function toResult<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await parseErrorResponse(response)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

async function request<T>(path: string, init: RequestInit & RequestOptions = {}): Promise<T> {
  const response = await rawFetch(path, init)

  if (response.status === 401 && !init.skipAuthRetry) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      const retryResponse = await rawFetch(path, init)
      return toResult<T>(retryResponse)
    }
    authSession.setAccessToken(null)
    authSession.notifyUnauthorized()
  }

  return toResult<T>(response)
}

export const httpClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { method: 'GET', ...options }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      method: 'POST',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...options,
    }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      method: 'PUT',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...options,
    }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      method: 'PATCH',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...options,
    }),
}

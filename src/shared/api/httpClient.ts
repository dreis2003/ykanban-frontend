import { env } from '@/app/config/env'
import { ApiError } from '@/shared/api/apiError'
import { isProblemDetails } from '@/shared/types/problemDetails'

interface RequestOptions {
  signal?: AbortSignal
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

async function request<T>(path: string, init: RequestInit & RequestOptions = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        // Ponto de extensão futuro: Authorization (JWT) e X-Request-Id (correlation id)
        // serão adicionados aqui quando a autenticação for implementada.
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError('Não foi possível conectar ao backend. Verifique se ele está em execução.')
  }

  if (!response.ok) {
    throw await parseErrorResponse(response)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export const httpClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { method: 'GET', ...options }),
}

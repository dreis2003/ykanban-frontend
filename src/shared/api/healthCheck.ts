import { env } from '@/app/config/env'
import { ApiError } from '@/shared/api/apiError'

interface HealthResponse {
  status: string
}

/**
 * O backend ainda não expõe nenhum endpoint sob /api/v1 — o único disponível hoje é o
 * Actuator, publicado na raiz do backend (fora do prefixo versionado da API de negócio).
 */
export async function checkBackendHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const backendOrigin = new URL(env.apiBaseUrl).origin

  let response: Response
  try {
    response = await fetch(`${backendOrigin}/actuator/health`, {
      ...(signal ? { signal } : {}),
      headers: { Accept: 'application/json' },
    })
  } catch {
    throw new ApiError('Não foi possível conectar ao backend. Verifique se ele está em execução.')
  }

  if (!response.ok) {
    throw new ApiError(`Backend respondeu com status ${response.status}`, {
      status: response.status,
    })
  }

  return (await response.json()) as HealthResponse
}

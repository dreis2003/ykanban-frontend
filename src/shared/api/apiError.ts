import type { ProblemDetails } from '@/shared/types/problemDetails'

/**
 * Erro de comunicação com a API — cobre tanto respostas HTTP com Problem Details
 * quanto falhas de rede (backend indisponível, sem conexão, etc).
 */
export class ApiError extends Error {
  readonly status?: number | undefined
  readonly problem?: ProblemDetails | undefined

  constructor(
    message: string,
    options?: { status?: number | undefined; problem?: ProblemDetails | undefined },
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = options?.status
    this.problem = options?.problem
  }
}

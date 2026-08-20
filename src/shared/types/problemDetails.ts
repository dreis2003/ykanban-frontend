/**
 * RFC 9457 Problem Details — formato de erro retornado pelo GlobalExceptionHandler do backend.
 */
export interface ValidationError {
  field: string
  message: string
}

export interface ProblemDetails {
  type?: string
  title: string
  status: number
  detail?: string
  instance?: string
  errors?: ValidationError[]
  /** Propriedade extra adicionada via `ProblemDetail#setProperty` (ver ADR 0029/Prompt 30) — hoje
   * só usada por `ACCOUNT_ALREADY_EXISTS_LOGIN_REQUIRED` no fluxo de Account Setup. */
  code?: string
}

export function isProblemDetails(value: unknown): value is ProblemDetails {
  return (
    typeof value === 'object' &&
    value !== null &&
    'title' in value &&
    'status' in value &&
    typeof (value as { status: unknown }).status === 'number'
  )
}

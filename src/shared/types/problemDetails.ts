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

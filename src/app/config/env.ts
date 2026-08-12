const DEFAULT_API_BASE_URL = 'http://localhost:8080/api/v1'

function readApiBaseUrl(): string {
  const value = import.meta.env.VITE_API_BASE_URL
  if (!value) {
    console.warn(
      `VITE_API_BASE_URL não definida — usando fallback "${DEFAULT_API_BASE_URL}". ` +
        'Configure a variável de ambiente para o ambiente atual.',
    )
    return DEFAULT_API_BASE_URL
  }
  return value
}

export const env = {
  apiBaseUrl: readApiBaseUrl(),
} as const

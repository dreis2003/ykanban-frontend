type UnauthorizedListener = () => void

let accessToken: string | null = null
let unauthorizedListener: UnauthorizedListener | null = null

/**
 * Estado de sessão compartilhado entre httpClient e AuthProvider. Vive em shared/api (não em
 * features/auth) porque o httpClient não pode depender de uma feature — a dependência é sempre
 * na direção oposta.
 */
export const authSession = {
  getAccessToken(): string | null {
    return accessToken
  },
  setAccessToken(token: string | null): void {
    accessToken = token
  },
  onUnauthorized(listener: UnauthorizedListener | null): void {
    unauthorizedListener = listener
  },
  notifyUnauthorized(): void {
    unauthorizedListener?.()
  },
}

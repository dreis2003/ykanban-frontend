export type UserRole = 'ADMIN' | 'PROJECT_MANAGER' | 'DEVELOPER' | 'VIEWER'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
}

export interface LoginResponse {
  accessToken: string
  expiresIn: number
  user: AuthUser
}

export interface AccessTokenResponse {
  accessToken: string
  expiresIn: number
}

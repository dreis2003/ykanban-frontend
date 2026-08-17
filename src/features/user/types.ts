export type UserStatus = 'ACTIVE' | 'INACTIVE'

/** Sem role: role é sempre da Membership no Tenant ativo, não faz sentido num usuário genérico
 * do seletor de responsável (ver ADR 0020). */
export interface UserSummary {
  id: string
  name: string
  email: string
  status: UserStatus
}

export interface ListUsersParams {
  status?: UserStatus
  search?: string
  page?: number
  size?: number
}

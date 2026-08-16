export type UserStatus = 'ACTIVE' | 'INACTIVE'

export interface UserSummary {
  id: string
  name: string
  email: string
  status: UserStatus
  role: string
}

export interface ListUsersParams {
  status?: UserStatus
  search?: string
  page?: number
  size?: number
}

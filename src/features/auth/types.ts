export type MembershipRole = 'ADMIN' | 'PROJECT_MANAGER' | 'DEVELOPER' | 'VIEWER'
export type MembershipStatus = 'ACTIVE' | 'INACTIVE'
export type TenantStatus = 'ACTIVE' | 'SUSPENDED'
export type AuthenticationContext = 'TENANT_SELECTION' | 'TENANT_ACCESS'

/** Identidade global — nunca carrega role (ver ADR 0020: role é sempre da Membership do Tenant ativo). */
export interface AuthUser {
  id: string
  name: string
  email: string
}

export interface Tenant {
  id: string
  name: string
  slug: string
  status: TenantStatus
}

export interface AvailableTenant {
  id: string
  name: string
  slug: string
  tenantStatus: TenantStatus
  membershipRole: MembershipRole
}

export interface LoginResponse {
  accessToken: string
  expiresIn: number
  user: AuthUser
  context: AuthenticationContext
  tenant: Tenant | null
  membershipRole: MembershipRole | null
}

export interface AccessTokenResponse {
  accessToken: string
  expiresIn: number
}

export interface TenantSelectionResponse {
  accessToken: string
  expiresIn: number
  tenant: Tenant
  membershipRole: MembershipRole
}

export interface MeResponse {
  user: AuthUser
  context: AuthenticationContext
  tenant: Tenant | null
  membership: { role: MembershipRole; status: MembershipStatus } | null
}

export type TenantStatus = 'ACTIVE' | 'SUSPENDED'

export interface PlatformTenant {
  id: string
  name: string
  slug: string
  status: TenantStatus
  memberCount: number
  projectCount: number
  createdAt: string
  updatedAt: string
}

export interface PlatformTenantAdmin {
  id: string
  name: string
  email: string
}

export type InitialAdminInvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'

/** Estado do convite de ADMIN inicial de um Tenant (ver ADR 0024) — nunca inclui token. */
export interface InitialAdminInvitation {
  id: string
  email: string
  status: InitialAdminInvitationStatus
  createdAt: string
  expiresAt: string
  lastEmailSentAt: string | null
}

/** {@code initialAdminInvitation} é {@code null} quando já existe ADMIN ativo (onboarding
 * concluído) ou quando o Tenant não tem nenhum convite registrado. */
export interface PlatformTenantDetail extends PlatformTenant {
  admins: PlatformTenantAdmin[]
  initialAdminInvitation: InitialAdminInvitation | null
}

export interface PlatformDashboard {
  totalTenants: number
  activeTenants: number
  suspendedTenants: number
  uniqueUsers: number
  totalProjects: number
}

export type PlatformTenantSortOption =
  | 'name,asc'
  | 'name,desc'
  | 'slug,asc'
  | 'status,asc'
  | 'createdAt,desc'

export interface ListPlatformTenantsParams {
  search?: string
  status?: TenantStatus
  page?: number
  size?: number
  sort?: PlatformTenantSortOption
}

/** Resposta de {@code POST /platform/tenants} — provisionamento completo (ver ADR 0024). Nunca
 * inclui o token bruto do convite. */
export interface ProvisioningResponse {
  tenant: PlatformTenant
  initialAdminInvitation: {
    id: string
    email: string
    status: InitialAdminInvitationStatus
    expiresAt: string
    emailSent: boolean
  }
}

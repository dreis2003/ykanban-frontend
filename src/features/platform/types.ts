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

export interface PlatformTenantDetail extends PlatformTenant {
  admins: PlatformTenantAdmin[]
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

import type { MembershipRole } from '@/features/auth/types'

export type { MembershipRole }

/** Tri-state — diferente de {@code MembershipStatus} de auth/types (que só existe para a
 * Membership do próprio usuário logado, sempre ACTIVE quando presente). REMOVED nunca reverte
 * por aqui (ver ADR 0021) — reentrada é escopo do Prompt 22 (convites). */
export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'REMOVED'

export interface Member {
  membershipId: string
  userId: string
  name: string
  email: string
  role: MembershipRole
  status: MemberStatus
  joinedAt: string
  updatedAt: string
}

export type MemberSortOption =
  | 'name,asc'
  | 'name,desc'
  | 'email,asc'
  | 'role,asc'
  | 'status,asc'
  | 'createdAt,desc'

export interface ListMembersParams {
  search?: string
  role?: MembershipRole
  status?: MemberStatus
  page?: number
  size?: number
  sort?: MemberSortOption
}

import type { MembershipRole } from '@/features/auth/types'

export type { MembershipRole }

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'

export interface InvitedBy {
  id: string
  name: string
}

export interface Invitation {
  id: string
  email: string
  role: MembershipRole
  status: InvitationStatus
  invitedBy: InvitedBy
  createdAt: string
  expiresAt: string
  lastEmailSentAt: string | null
}

export interface InvitationCreated {
  invitation: Invitation
  emailDelivered: boolean
}

export type InvitationSortOption = 'createdAt,desc' | 'email,asc' | 'role,asc' | 'expiresAt,asc'

export interface ListInvitationsParams {
  search?: string
  role?: MembershipRole
  status?: InvitationStatus
  page?: number
  size?: number
  sort?: InvitationSortOption
}

export interface InviteMemberRequest {
  email: string
  role: MembershipRole
}

/** Contrato do endpoint público de consulta — nunca inclui tenantId interno, e-mail de quem
 * convidou, ou qualquer dado de outro usuário (ver ADR 0022). */
export interface PublicInvitation {
  valid: boolean
  status: InvitationStatus | null
  organization: { name: string } | null
  email: string | null
  role: MembershipRole | null
  expiresAt: string | null
}

export interface RegisterViaInvitationRequest {
  name: string
  password: string
}

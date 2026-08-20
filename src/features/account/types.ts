export interface PendingEmailChange {
  maskedNewEmail: string
  expiresAt: string
}

/** "Minha Conta" (ver ADR 0030/Prompt 31) — identidade GLOBAL do User, nunca depende de Tenant ativo. */
export interface Account {
  id: string
  name: string
  email: string
  status: string
  emailVerified: boolean
  emailVerifiedAt: string | null
  createdAt: string
  pendingEmailChange: PendingEmailChange | null
}

export interface UpdateProfileRequest {
  name: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface RequestPasswordResetRequest {
  email: string
}

export interface ValidatePasswordResetResponse {
  valid: boolean
  expiresAt: string | null
}

export interface ConfirmPasswordResetRequest {
  token: string
  newPassword: string
}

export interface RequestEmailChangeRequest {
  newEmail: string
  currentPassword: string
}

export interface ConfirmEmailChangeRequest {
  token: string
}

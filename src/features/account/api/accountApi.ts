import { httpClient } from '@/shared/api/httpClient'
import type {
  Account,
  ChangePasswordRequest,
  ConfirmEmailChangeRequest,
  ConfirmPasswordResetRequest,
  RequestEmailChangeRequest,
  RequestPasswordResetRequest,
  UpdateProfileRequest,
  ValidatePasswordResetResponse,
} from '@/features/account/types'

/**
 * "Minha Conta" (ver ADR 0030/Prompt 31) — endpoints autenticados sob `/account/**` aceitam
 * QUALQUER contexto de token (ver SecurityConfig backend, mesma lista de `/auth/me`); os `/public/
 * password-resets/**` e `/public/email-changes/**` nunca exigem sessão (sempre `skipAuthRetry`).
 */
export const accountApi = {
  getAccount: () => httpClient.get<Account>('/account'),

  updateProfile: (payload: UpdateProfileRequest) => httpClient.patch<Account>('/account/profile', payload),

  changePassword: (payload: ChangePasswordRequest) => httpClient.post<void>('/account/password/change', payload),

  requestEmailChange: (payload: RequestEmailChangeRequest) => httpClient.post<void>('/account/email-change', payload),

  resendEmailChange: () => httpClient.post<void>('/account/email-change/resend'),

  cancelEmailChange: () => httpClient.post<void>('/account/email-change/cancel'),

  revokeAllSessions: () => httpClient.post<void>('/account/sessions/revoke-all'),

  requestPasswordReset: (payload: RequestPasswordResetRequest) =>
    httpClient.post<void>('/public/password-resets', payload, { skipAuthRetry: true }),

  validatePasswordReset: (token: string) =>
    httpClient.post<ValidatePasswordResetResponse>('/public/password-resets/validate', { token }, { skipAuthRetry: true }),

  confirmPasswordReset: (payload: ConfirmPasswordResetRequest) =>
    httpClient.post<void>('/public/password-resets/confirm', payload, { skipAuthRetry: true }),

  confirmEmailChange: (payload: ConfirmEmailChangeRequest) =>
    httpClient.post<void>('/public/email-changes/confirm', payload, { skipAuthRetry: true }),
}

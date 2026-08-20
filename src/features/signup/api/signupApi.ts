import { httpClient } from '@/shared/api/httpClient'
import type { LoginResponse, TenantSelectionResponse } from '@/features/auth/types'
import type {
  AccountSetupRegisterRequest,
  AccountSetupValidation,
  CreateSubscriptionSignupRequest,
  PublicPlan,
  SubscriptionSignupCreated,
  SubscriptionSignupStatusResponse,
} from '@/features/signup/types'

/** Fluxo público payment-first (ver ADR 0029/Prompt 30) — todo endpoint aqui é `/public/**`,
 * sempre com `skipAuthRetry` (não há sessão para renovar; evita loop de refresh desnecessário). */
export const signupApi = {
  listPlans: () => httpClient.get<PublicPlan[]>('/public/plans', { skipAuthRetry: true }),

  createSignup: (payload: CreateSubscriptionSignupRequest) =>
    httpClient.post<SubscriptionSignupCreated>('/public/subscription-signups', payload, { skipAuthRetry: true }),

  signupStatus: (signupId: string) =>
    httpClient.get<SubscriptionSignupStatusResponse>(`/public/subscription-signups/${signupId}/status`, {
      skipAuthRetry: true,
    }),

  validateAccountSetup: (token: string) =>
    httpClient.post<AccountSetupValidation>('/public/account-setup/validate', { token }, { skipAuthRetry: true }),

  registerAccountSetup: (payload: AccountSetupRegisterRequest) =>
    httpClient.post<LoginResponse>('/public/account-setup/register', payload, { skipAuthRetry: true }),

  resendAccountSetup: (email: string) =>
    httpClient.post<void>('/public/account-setup/resend', { email }, { skipAuthRetry: true }),

  // Autenticado — QUALQUER contexto de token (ver SecurityConfig backend).
  acceptAccountSetup: (token: string) => httpClient.post<TenantSelectionResponse>('/account-setup/accept', { token }),
}

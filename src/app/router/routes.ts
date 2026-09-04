/** Caminhos centralizados da aplicação. */
export const ROUTES = {
  home: '/',
  login: '/login',
  // Fluxo comercial público payment-first (ver ADR 0029/Prompt 30) — entrada principal de
  // aquisição do YKanban, nunca `/signup` (que exigiria conta antes do Checkout).
  subscribe: '/subscribe',
  subscriptionSuccess: '/subscription/success',
  accountSetup: '/account-setup',
  terms: '/terms',
  privacy: '/privacy',
  // "Minha Conta" (ver ADR 0030/Prompt 31) — GLOBAL ao User, fora das árvores de MainLayout/
  // PlatformLayout (acessível a partir das duas, ver item 275). Esqueci-senha/reset/confirmação
  // de troca de e-mail são públicas, dentro de PublicLayout.
  account: '/account',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  confirmEmailChange: '/confirm-email-change',
  selectOrganization: '/select-organization',
  projects: '/projects',
  members: '/settings/members',
  subscription: '/settings/subscription',
  integrations: '/settings/integrations',
  checkoutSuccess: '/settings/subscription/checkout/success',
  platformDashboard: '/platform',
  platformTenants: '/platform/tenants',
  platformTenantDetail: (tenantId: string) => `/platform/tenants/${tenantId}`,
  platformPlans: '/platform/plans',
  platformPlanDetail: (planId: string) => `/platform/plans/${planId}`,
  acceptInvitation: (token: string) => `/invitations/${token}`,
  projectDetail: (id: string) => `/projects/${id}`,
  projectDashboard: (id: string) => `/projects/${id}/dashboard`,
  projectNotifications: (id: string) => `/projects/${id}/notifications`,
  projectRepositories: (id: string) => `/projects/${id}/repositories`,
  projectRepositoryTechnicalConfiguration: (projectId: string, repositoryId: string) =>
    `/projects/${projectId}/repositories/${repositoryId}/technical-configuration`,
  cardDetail: (projectId: string, cardId: string) => `/projects/${projectId}/cards/${cardId}`,
} as const

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
  selectOrganization: '/select-organization',
  projects: '/projects',
  members: '/settings/members',
  subscription: '/settings/subscription',
  checkoutSuccess: '/settings/subscription/checkout/success',
  platformDashboard: '/platform',
  platformTenants: '/platform/tenants',
  platformTenantDetail: (tenantId: string) => `/platform/tenants/${tenantId}`,
  platformPlans: '/platform/plans',
  platformPlanDetail: (planId: string) => `/platform/plans/${planId}`,
  acceptInvitation: (token: string) => `/invitations/${token}`,
  projectDetail: (id: string) => `/projects/${id}`,
  projectDashboard: (id: string) => `/projects/${id}/dashboard`,
  cardDetail: (projectId: string, cardId: string) => `/projects/${projectId}/cards/${cardId}`,
} as const

/** Caminhos centralizados da aplicação. */
export const ROUTES = {
  home: '/',
  login: '/login',
  selectOrganization: '/select-organization',
  projects: '/projects',
  members: '/settings/members',
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

/** Caminhos centralizados da aplicação. */
export const ROUTES = {
  home: '/',
  login: '/login',
  projects: '/projects',
  projectDetail: (id: string) => `/projects/${id}`,
  projectDashboard: (id: string) => `/projects/${id}/dashboard`,
  cardDetail: (projectId: string, cardId: string) => `/projects/${projectId}/cards/${cardId}`,
} as const

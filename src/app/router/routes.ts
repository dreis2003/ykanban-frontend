/** Caminhos centralizados da aplicação. */
export const ROUTES = {
  home: '/',
  login: '/login',
  projects: '/projects',
  projectDetail: (id: string) => `/projects/${id}`,
  cardDetail: (projectId: string, cardId: string) => `/projects/${projectId}/cards/${cardId}`,
} as const

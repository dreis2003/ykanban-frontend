/**
 * Caminhos centralizados da aplicação. Rotas de board/card entram aqui junto
 * da respectiva feature — não criadas nesta etapa.
 */
export const ROUTES = {
  home: '/',
  login: '/login',
  projects: '/projects',
  projectDetail: (id: string) => `/projects/${id}`,
} as const

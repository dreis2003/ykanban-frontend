import { createBrowserRouter, Navigate } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout/MainLayout'
import { LoginPage } from '@/app/pages/LoginPage/LoginPage'
import { NotFoundPage } from '@/app/pages/NotFoundPage/NotFoundPage'
import { ProjectDetailPage } from '@/app/pages/ProjectDetailPage/ProjectDetailPage'
import { ProjectsPage } from '@/app/pages/ProjectsPage/ProjectsPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { ROUTES } from '@/app/router/routes'

/**
 * `/login` é a única rota pública. `/projects` é o destino pós-login (ver Prompt 04) — `/`
 * apenas redireciona para lá; não há mais uma "home" própria.
 */
export const router = createBrowserRouter([
  { path: ROUTES.login, element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <MainLayout />
      </RequireAuth>
    ),
    children: [
      { path: ROUTES.home, element: <Navigate to={ROUTES.projects} replace /> },
      { path: ROUTES.projects, element: <ProjectsPage /> },
      { path: '/projects/:projectId', element: <ProjectDetailPage /> },
      { path: '/projects/:projectId/cards/:cardId', element: <ProjectDetailPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

import { createBrowserRouter, Navigate } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout/MainLayout'
import { AcceptInvitationPage } from '@/app/pages/AcceptInvitationPage/AcceptInvitationPage'
import { LoginPage } from '@/app/pages/LoginPage/LoginPage'
import { MembersPage } from '@/app/pages/MembersPage/MembersPage'
import { NotFoundPage } from '@/app/pages/NotFoundPage/NotFoundPage'
import { ProjectDashboardPage } from '@/app/pages/ProjectDashboardPage/ProjectDashboardPage'
import { ProjectDetailPage } from '@/app/pages/ProjectDetailPage/ProjectDetailPage'
import { ProjectsPage } from '@/app/pages/ProjectsPage/ProjectsPage'
import { SelectOrganizationPage } from '@/app/pages/SelectOrganizationPage/SelectOrganizationPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { RequireAuthenticated } from '@/features/auth/RequireAuthenticated'
import { ROUTES } from '@/app/router/routes'

/**
 * `/login` e `/invitations/:token` são as únicas rotas totalmente públicas (ver ADR 0022 para a
 * segunda — precisa funcionar para quem ainda nem tem conta). `/select-organization` exige
 * identidade mas dispensa Tenant ativo (é onde ele é resolvido — ver ADR 0020); as demais exigem
 * os dois via {@code RequireAuth}. `/projects` é o destino pós-seleção — `/` apenas redireciona
 * para lá.
 */
export const router = createBrowserRouter([
  { path: ROUTES.login, element: <LoginPage /> },
  { path: '/invitations/:token', element: <AcceptInvitationPage /> },
  {
    path: ROUTES.selectOrganization,
    element: (
      <RequireAuthenticated>
        <SelectOrganizationPage />
      </RequireAuthenticated>
    ),
  },
  {
    element: (
      <RequireAuth>
        <MainLayout />
      </RequireAuth>
    ),
    children: [
      { path: ROUTES.home, element: <Navigate to={ROUTES.projects} replace /> },
      { path: ROUTES.projects, element: <ProjectsPage /> },
      { path: ROUTES.members, element: <MembersPage /> },
      { path: '/projects/:projectId', element: <ProjectDetailPage /> },
      { path: '/projects/:projectId/cards/:cardId', element: <ProjectDetailPage /> },
      { path: '/projects/:projectId/dashboard', element: <ProjectDashboardPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

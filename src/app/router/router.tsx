import { createBrowserRouter, Navigate } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout/MainLayout'
import { PlatformLayout } from '@/layouts/PlatformLayout/PlatformLayout'
import { PublicLayout } from '@/layouts/PublicLayout/PublicLayout'
import { AcceptInvitationPage } from '@/app/pages/AcceptInvitationPage/AcceptInvitationPage'
import { AccountSetupPage } from '@/app/pages/AccountSetupPage/AccountSetupPage'
import { CheckoutSuccessPage } from '@/app/pages/CheckoutSuccessPage/CheckoutSuccessPage'
import { PrivacyPage } from '@/app/pages/PrivacyPage/PrivacyPage'
import { SubscribePage } from '@/app/pages/SubscribePage/SubscribePage'
import { SubscriptionSuccessPage } from '@/app/pages/SubscriptionSuccessPage/SubscriptionSuccessPage'
import { TermsPage } from '@/app/pages/TermsPage/TermsPage'
import { LoginPage } from '@/app/pages/LoginPage/LoginPage'
import { MembersPage } from '@/app/pages/MembersPage/MembersPage'
import { NotFoundPage } from '@/app/pages/NotFoundPage/NotFoundPage'
import { PlatformDashboardPage } from '@/app/pages/PlatformDashboardPage/PlatformDashboardPage'
import { PlatformPlanDetailPage } from '@/app/pages/PlatformPlanDetailPage/PlatformPlanDetailPage'
import { PlatformPlansPage } from '@/app/pages/PlatformPlansPage/PlatformPlansPage'
import { PlatformTenantDetailPage } from '@/app/pages/PlatformTenantDetailPage/PlatformTenantDetailPage'
import { PlatformTenantsPage } from '@/app/pages/PlatformTenantsPage/PlatformTenantsPage'
import { ProjectDashboardPage } from '@/app/pages/ProjectDashboardPage/ProjectDashboardPage'
import { ProjectDetailPage } from '@/app/pages/ProjectDetailPage/ProjectDetailPage'
import { ProjectsPage } from '@/app/pages/ProjectsPage/ProjectsPage'
import { SelectOrganizationPage } from '@/app/pages/SelectOrganizationPage/SelectOrganizationPage'
import { TenantSubscriptionPage } from '@/app/pages/TenantSubscriptionPage/TenantSubscriptionPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { RequireAuthenticated } from '@/features/auth/RequireAuthenticated'
import { RequirePlatformAdmin } from '@/features/auth/RequirePlatformAdmin'
import { ROUTES } from '@/app/router/routes'

/**
 * `/login` e `/invitations/:token` são as únicas rotas totalmente públicas (ver ADR 0022 para a
 * segunda — precisa funcionar para quem ainda nem tem conta). `/select-organization` exige
 * identidade mas dispensa Tenant ativo (é onde ele é resolvido — ver ADR 0020); as demais exigem
 * os dois via {@code RequireAuth}. `/projects` é o destino pós-seleção — `/` apenas redireciona
 * para lá. `/platform/**` (ver ADR 0023) é uma árvore de rotas própria, irmã desta — exige
 * identidade e `PLATFORM_ADMIN` via {@code RequirePlatformAdmin}, nunca Tenant selecionado.
 */
export const router = createBrowserRouter([
  { path: ROUTES.login, element: <LoginPage /> },
  { path: '/invitations/:token', element: <AcceptInvitationPage /> },
  // Área comercial pública (ver ADR 0029/Prompt 30) — entrada principal de aquisição do YKanban,
  // nunca exige conta/login antes do Checkout. `/account-setup` também funciona autenticado (User
  // já existente assumindo uma nova empresa, ver PARTE V) — `PublicLayout` não bloqueia isso, só
  // não exige identidade.
  {
    element: <PublicLayout />,
    children: [
      { path: ROUTES.subscribe, element: <SubscribePage /> },
      { path: ROUTES.subscriptionSuccess, element: <SubscriptionSuccessPage /> },
      { path: ROUTES.accountSetup, element: <AccountSetupPage /> },
      { path: ROUTES.terms, element: <TermsPage /> },
      { path: ROUTES.privacy, element: <PrivacyPage /> },
    ],
  },
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
      { path: ROUTES.subscription, element: <TenantSubscriptionPage /> },
      { path: ROUTES.checkoutSuccess, element: <CheckoutSuccessPage /> },
      { path: '/projects/:projectId', element: <ProjectDetailPage /> },
      { path: '/projects/:projectId/cards/:cardId', element: <ProjectDetailPage /> },
      { path: '/projects/:projectId/dashboard', element: <ProjectDashboardPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    // Área de Platform Admin (ver ADR 0023) — deliberadamente FORA da árvore de `RequireAuth`/
    // `MainLayout`: não exige Tenant selecionado (um Platform Admin pode ter zero Memberships).
    element: (
      <RequirePlatformAdmin>
        <PlatformLayout />
      </RequirePlatformAdmin>
    ),
    children: [
      { path: ROUTES.platformDashboard, element: <PlatformDashboardPage /> },
      { path: ROUTES.platformTenants, element: <PlatformTenantsPage /> },
      { path: '/platform/tenants/:tenantId', element: <PlatformTenantDetailPage /> },
      { path: ROUTES.platformPlans, element: <PlatformPlansPage /> },
      { path: '/platform/plans/:planId', element: <PlatformPlanDetailPage /> },
    ],
  },
])

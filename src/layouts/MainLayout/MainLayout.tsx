import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { useAuth } from '@/features/auth/AuthContext'
import type { MembershipRole } from '@/features/auth/types'
import { entitlementsApi } from '@/features/entitlements/api/entitlementsApi'
import type { AccessReason } from '@/features/entitlements/types'
import { isSafeReturnTo } from '@/shared/utils/returnTo'
import styles from './MainLayout.module.css'

const ROLE_LABELS: Record<MembershipRole, string> = {
  ADMIN: 'Administrador',
  PROJECT_MANAGER: 'Gerente de Projetos',
  DEVELOPER: 'Desenvolvedor',
  VIEWER: 'Visualizador',
}

/** Mensagens de somente-leitura (ver ADR 0026, itens 158-159) — Tenant SUSPENDED tem mensagem
 * distinta de assinatura ausente/expirada; {@code NORMAL} nunca aparece aqui (banner só renderiza
 * quando {@code accessMode === 'READ_ONLY'}). */
const READ_ONLY_MESSAGES: Partial<Record<AccessReason, { title: string; description: string }>> = {
  TENANT_SUSPENDED: {
    title: 'Esta organização está suspensa.',
    description: 'A organização está temporariamente em modo somente leitura.',
  },
  SUBSCRIPTION_INACTIVE: {
    title: 'A assinatura desta organização não está ativa.',
    description: 'Os dados continuam disponíveis para consulta, mas alterações estão temporariamente bloqueadas.',
  },
  TRIAL_EXPIRED: {
    title: 'O período de teste desta organização expirou.',
    description: 'Os dados continuam disponíveis para consulta, mas alterações estão temporariamente bloqueadas.',
  },
  PAST_DUE_GRACE_EXPIRED: {
    title: 'O pagamento desta organização está pendente e o período de tolerância encerrou.',
    description: 'Os dados continuam disponíveis para consulta, mas alterações estão temporariamente bloqueadas até a regularização.',
  },
  // Ver ADR 0028, PARTE O — nunca têm grace period (exclusivo de PAST_DUE): bloqueio imediato.
  SUBSCRIPTION_INCOMPLETE: {
    title: 'O pagamento da assinatura desta organização ainda não foi confirmado.',
    description: 'Conclua o pagamento para liberar alterações — os dados continuam disponíveis para consulta.',
  },
  SUBSCRIPTION_UNPAID: {
    title: 'A assinatura desta organização está com pagamento em aberto.',
    description: 'Regularize o pagamento pelo provider de cobrança — os dados continuam disponíveis para consulta.',
  },
  SUBSCRIPTION_PAUSED: {
    title: 'A assinatura desta organização está pausada.',
    description: 'Os dados continuam disponíveis para consulta, mas alterações estão temporariamente bloqueadas.',
  },
}

/** {@code PAST_DUE_GRACE} nunca bloqueia escrita — só avisa (ver ADR 0027, PARTE D). Mensagem
 * separada de {@link READ_ONLY_MESSAGES} porque o {@code accessMode} aqui é sempre {@code
 * READ_WRITE}. */
const WARNING_MESSAGES: Partial<Record<AccessReason, { title: string; description: string }>> = {
  PAST_DUE_GRACE: {
    title: 'O pagamento desta organização está pendente.',
    description: 'Você ainda pode usar o sistema normalmente durante o período de tolerância — regularize o pagamento para evitar bloqueio.',
  },
}

/**
 * Casca visual reutilizável para as telas autenticadas do YKanban.
 * Header traz marca, identidade do usuário (nome + Role da Membership no Tenant ativo — nunca
 * `User.role`, ver ADR 0020) e logout — sidebar e navegação de funcionalidades entram junto das
 * features que as exigirem.
 */
export function MainLayout() {
  const { user, activeTenant, membershipRole, platformRoles, logout, refreshAvailableTenants } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Chave inclui o Tenant ativo (ver ADR 0026, item 264) — troca de organização nunca reaproveita
  // cache de outro Tenant, mesmo por uma fração de segundo antes do novo fetch completar.
  const { data: entitlements } = useQuery({
    queryKey: ['entitlements', activeTenant?.id],
    queryFn: entitlementsApi.current,
    enabled: Boolean(activeTenant),
  })
  const readOnlyMessage =
    entitlements?.accessMode === 'READ_ONLY' ? (READ_ONLY_MESSAGES[entitlements.accessReason] ?? null) : null
  const warningMessage =
    entitlements?.accessMode === 'READ_WRITE' ? (WARNING_MESSAGES[entitlements.accessReason] ?? null) : null

  const handleSwitchOrganization = useCallback(() => {
    void refreshAvailableTenants().then(() => navigate(ROUTES.selectOrganization))
  }, [refreshAvailableTenants, navigate])

  // `returnTo` só é anexado quando a página atual é uma das rotas que a tela de Membros sabe voltar
  // para (ver `resolveReturnTo`) — evita propagar um valor que seria descartado do outro lado mesmo
  // assim, e mantém a URL limpa quando não há para onde voltar.
  const membersHref = isSafeReturnTo(location.pathname)
    ? `${ROUTES.members}?returnTo=${encodeURIComponent(location.pathname)}`
    : ROUTES.members

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            Y
          </span>
          <div className={styles.brandText}>
            <span className={styles.brandName}>YKanban</span>
            <span className={styles.brandSub}>{activeTenant?.name ?? 'Yakuza Studio'}</span>
          </div>
        </div>

        <nav className={styles.nav}>
          <NavLink
            to={ROUTES.projects}
            className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}
          >
            Projetos
          </NavLink>
          {membershipRole === 'ADMIN' ? (
            <NavLink
              to={membersHref}
              className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}
            >
              Membros
            </NavLink>
          ) : null}
          {membershipRole === 'ADMIN' ? (
            <NavLink
              to={ROUTES.subscription}
              className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}
            >
              Assinatura
            </NavLink>
          ) : null}
          {platformRoles.includes('PLATFORM_ADMIN') ? (
            <NavLink
              to={ROUTES.platformDashboard}
              className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}
            >
              Administração da Plataforma
            </NavLink>
          ) : null}
        </nav>

        {user ? (
          <div className={styles.session}>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user.name}</span>
              <span className={styles.userRole}>{membershipRole ? ROLE_LABELS[membershipRole] : ''}</span>
            </div>
            <button type="button" className={styles.switchOrg} onClick={handleSwitchOrganization}>
              Trocar organização
            </button>
            <button type="button" className={styles.logout} onClick={() => void logout()}>
              Sair
            </button>
          </div>
        ) : null}
      </header>
      <main className={styles.main}>
        {readOnlyMessage ? (
          <div className={styles.readOnlyBanner} data-reason={entitlements?.accessReason} role="status">
            <span className={styles.readOnlyBannerTitle}>{readOnlyMessage.title}</span>
            <span>{readOnlyMessage.description}</span>
          </div>
        ) : null}
        {warningMessage ? (
          <div className={styles.readOnlyBanner} data-reason={entitlements?.accessReason} role="status">
            <span className={styles.readOnlyBannerTitle}>{warningMessage.title}</span>
            <span>{warningMessage.description}</span>
          </div>
        ) : null}
        <Outlet />
      </main>
    </div>
  )
}

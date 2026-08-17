import { useCallback } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { useAuth } from '@/features/auth/AuthContext'
import type { MembershipRole } from '@/features/auth/types'
import styles from './MainLayout.module.css'

const ROLE_LABELS: Record<MembershipRole, string> = {
  ADMIN: 'Administrador',
  PROJECT_MANAGER: 'Gerente de Projetos',
  DEVELOPER: 'Desenvolvedor',
  VIEWER: 'Visualizador',
}

/**
 * Casca visual reutilizável para as telas autenticadas do YKanban.
 * Header traz marca, identidade do usuário (nome + Role da Membership no Tenant ativo — nunca
 * `User.role`, ver ADR 0020) e logout — sidebar e navegação de funcionalidades entram junto das
 * features que as exigirem.
 */
export function MainLayout() {
  const { user, activeTenant, membershipRole, logout, refreshAvailableTenants } = useAuth()
  const navigate = useNavigate()

  const handleSwitchOrganization = useCallback(() => {
    void refreshAvailableTenants().then(() => navigate(ROUTES.selectOrganization))
  }, [refreshAvailableTenants, navigate])

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

        {membershipRole === 'ADMIN' ? (
          <nav className={styles.nav}>
            <NavLink
              to={ROUTES.members}
              className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}
            >
              Membros
            </NavLink>
          </nav>
        ) : null}

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
        <Outlet />
      </main>
    </div>
  )
}

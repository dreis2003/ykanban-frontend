import { Link, NavLink, Outlet } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { useAuth } from '@/features/auth/AuthContext'
import styles from './PlatformLayout.module.css'

/**
 * Casca visual da área administrativa da plataforma SaaS — visualmente distinta da UI de Tenant
 * (ver ADR 0023, item 154): acento de cor diferente (`data-area="platform"`, ver
 * PlatformLayout.module.css), sem seletor de Organização/Tenant ativo (Platform Admin pode não ter
 * nenhum). Sempre oferece uma saída explícita de volta para a área do Tenant.
 */
export function PlatformLayout() {
  const { user, logout } = useAuth()

  return (
    <div className={styles.shell} data-area="platform">
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            Y
          </span>
          <div className={styles.brandText}>
            <span className={styles.brandName}>YKanban</span>
            <span className={styles.brandSub}>Administração da Plataforma</span>
          </div>
        </div>

        <nav className={styles.nav}>
          <NavLink
            to={ROUTES.platformDashboard}
            end
            className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}
          >
            Dashboard
          </NavLink>
          <NavLink
            to={ROUTES.platformTenants}
            className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}
          >
            Empresas
          </NavLink>
          <NavLink
            to={ROUTES.platformPlans}
            className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}
          >
            Planos
          </NavLink>
        </nav>

        {user ? (
          <div className={styles.session}>
            <span className={styles.userName}>{user.name}</span>
            <Link to={ROUTES.projects} className={styles.exit}>
              Voltar ao YKanban
            </Link>
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

import { Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import styles from './MainLayout.module.css'

/**
 * Casca visual reutilizável para as telas autenticadas do YKanban.
 * Header traz marca, identidade do usuário e logout — sidebar e navegação
 * de funcionalidades entram junto das features que as exigirem.
 */
export function MainLayout() {
  const { user, logout } = useAuth()

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            Y
          </span>
          <div className={styles.brandText}>
            <span className={styles.brandName}>YKanban</span>
            <span className={styles.brandSub}>Yakuza Studio</span>
          </div>
        </div>

        {user ? (
          <div className={styles.session}>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user.name}</span>
              <span className={styles.userRole}>{user.role}</span>
            </div>
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

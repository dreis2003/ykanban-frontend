import { Outlet } from 'react-router-dom'
import styles from './MainLayout.module.css'

/**
 * Casca visual reutilizável para as telas autenticadas do YKanban.
 * Hoje contém apenas o header com a marca — sidebar, navegação e
 * informações do usuário serão adicionadas junto das features que os exigem.
 */
export function MainLayout() {
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
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

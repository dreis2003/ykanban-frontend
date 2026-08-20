import { Link, Outlet } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import styles from './PublicLayout.module.css'

/**
 * Casca visual da área comercial pública (ver ADR 0029/Prompt 30, item 13) — nunca reaproveita
 * `MainLayout`/`PlatformLayout` (ambos exigem sessão/identidade); esta é a única casca sem
 * nenhuma dependência de autenticação. Header mínimo: marca, link para Planos e para Entrar.
 */
export function PublicLayout() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to={ROUTES.subscribe} className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            Y
          </span>
          <span className={styles.brandName}>YKanban</span>
        </Link>
        <nav className={styles.nav}>
          <Link to={ROUTES.subscribe} className={styles.navLink}>
            Planos
          </Link>
          <Link to={ROUTES.login} className={styles.navLinkPrimary}>
            Entrar
          </Link>
        </nav>
      </header>
      <main className={styles.content}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <p>
          <Link to={ROUTES.terms}>Termos de Uso</Link> · <Link to={ROUTES.privacy}>Política de Privacidade</Link>
        </p>
        <p className={styles.copyright}>Yakuza Studio</p>
      </footer>
    </div>
  )
}

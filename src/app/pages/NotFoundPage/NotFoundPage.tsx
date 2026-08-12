import { Link } from 'react-router-dom'
import styles from './NotFoundPage.module.css'

export function NotFoundPage() {
  return (
    <section className={styles.container}>
      <p className={styles.code}>404</p>
      <h1 className={styles.title}>Página não encontrada</h1>
      <p className={styles.description}>O endereço acessado não existe no YKanban.</p>
      <Link to="/" className={styles.link}>
        Voltar ao início
      </Link>
    </section>
  )
}

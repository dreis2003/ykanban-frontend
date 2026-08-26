import { Link } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import type { Project } from '@/features/projects/types'
import { StatusBadge } from '@/shared/components/StatusBadge/StatusBadge'
import styles from './ProjectPageHeader.module.css'

interface Props {
  project: Project
  active: 'kanban' | 'dashboard' | 'notifications'
}

/** Compartilhado entre `ProjectDetailPage` (Kanban), `ProjectDashboardPage` e `ProjectNotificationsPage` — mesma identidade
 * visual do Project e a mesma navegação entre as seções em todas as telas. */
export function ProjectPageHeader({ project, active }: Props) {
  return (
    <>
      <header className={styles.header}>
        <span className={styles.code}>{project.code}</span>
        <h1 className={styles.title}>{project.name}</h1>
        <StatusBadge status={project.status} />
      </header>

      {project.status === 'ARCHIVED' ? (
        <p className={styles.archivedNotice} role="status">
          Este projeto está arquivado e está em modo somente leitura.
        </p>
      ) : null}

      <nav className={styles.tabs} aria-label="Seções do projeto">
        <Link
          to={ROUTES.projectDetail(project.id)}
          className={styles.tab}
          aria-current={active === 'kanban' ? 'page' : undefined}
        >
          Kanban
        </Link>
        <Link
          to={ROUTES.projectDashboard(project.id)}
          className={styles.tab}
          aria-current={active === 'dashboard' ? 'page' : undefined}
        >
          Dashboard
        </Link>
        <Link
          to={ROUTES.projectNotifications(project.id)}
          className={styles.tab}
          aria-current={active === 'notifications' ? 'page' : undefined}
        >
          Notificações
        </Link>
      </nav>
    </>
  )
}

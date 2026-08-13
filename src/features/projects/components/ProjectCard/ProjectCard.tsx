import { Link } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { formatDate } from '@/shared/utils/formatDate'
import type { Project } from '@/features/projects/types'
import { StatusBadge } from '@/shared/components/StatusBadge/StatusBadge'
import styles from './ProjectCard.module.css'

interface Props {
  project: Project
  canManage: boolean
  onEdit: () => void
  onArchive: () => void
  onActivate: () => void
}

export function ProjectCard({ project, canManage, onEdit, onArchive, onActivate }: Props) {
  return (
    <article className={styles.card}>
      <Link to={ROUTES.projectDetail(project.id)} className={styles.openLink}>
        <div className={styles.header}>
          <span className={styles.code}>{project.code}</span>
          <StatusBadge status={project.status} />
        </div>
        <h3 className={styles.name}>{project.name}</h3>
        {project.description ? <p className={styles.description}>{project.description}</p> : null}
        <p className={styles.updatedAt}>Atualizado em {formatDate(project.updatedAt)}</p>
      </Link>

      {canManage ? (
        <div className={styles.actions}>
          <button type="button" className={styles.actionButton} onClick={onEdit}>
            Editar
          </button>
          {project.status === 'ACTIVE' ? (
            <button type="button" className={styles.actionButton} onClick={onArchive}>
              Arquivar
            </button>
          ) : (
            <button type="button" className={styles.actionButton} onClick={onActivate}>
              Reativar
            </button>
          )}
        </div>
      ) : null}
    </article>
  )
}

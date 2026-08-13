import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { ProjectBoard } from '@/features/board/components/ProjectBoard/ProjectBoard'
import { useAuth } from '@/features/auth/AuthContext'
import { projectsApi } from '@/features/projects/api/projectsApi'
import { formatDate } from '@/shared/utils/formatDate'
import { StatusBadge } from '@/shared/components/StatusBadge/StatusBadge'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './ProjectDetailPage.module.css'

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const canManage = user?.role === 'ADMIN' || user?.role === 'PROJECT_MANAGER'
  // Diferente da edição de coluna (ADMIN/PM), Card também pode ser criado/editado por DEVELOPER —
  // só VIEWER é somente leitura (ver agent_docs/business-rules.md).
  const canManageCards = user?.role !== 'VIEWER'

  const {
    data: project,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsApi.get(projectId as string),
    enabled: Boolean(projectId),
  })

  return (
    <section className={styles.page}>
      <Link to={ROUTES.projects} className={styles.back}>
        <ArrowLeft size={16} aria-hidden="true" />
        Projetos
      </Link>

      {isLoading ? <StatusMessage variant="loading" title="Carregando projeto…" /> : null}

      {isError ? <StatusMessage variant="error" title="Não foi possível carregar o projeto." /> : null}

      {!isLoading && !isError && project ? (
        <div className={styles.card}>
          <div className={styles.header}>
            <span className={styles.code}>{project.code}</span>
            <StatusBadge status={project.status} />
          </div>

          <h1 className={styles.title}>{project.name}</h1>

          {project.description ? <p className={styles.description}>{project.description}</p> : null}

          <dl className={styles.meta}>
            <div>
              <dt>Criado em</dt>
              <dd>{formatDate(project.createdAt)}</dd>
            </div>
            <div>
              <dt>Atualizado em</dt>
              <dd>{formatDate(project.updatedAt)}</dd>
            </div>
          </dl>

          {project.status === 'ARCHIVED' ? (
            <p className={styles.archivedNotice} role="status">
              Este projeto está arquivado e está em modo somente leitura.
            </p>
          ) : null}
        </div>
      ) : null}

      {!isLoading && !isError && project ? (
        <ProjectBoard
          projectId={project.id}
          canManage={canManage}
          canManageCards={canManageCards}
          isReadOnly={project.status === 'ARCHIVED'}
        />
      ) : null}
    </section>
  )
}

import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { ProjectBoard } from '@/features/board/components/ProjectBoard/ProjectBoard'
import { useAuth } from '@/features/auth/AuthContext'
import { projectsApi } from '@/features/projects/api/projectsApi'
import { ProjectPageHeader } from '@/features/projects/components/ProjectPageHeader/ProjectPageHeader'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './ProjectDetailPage.module.css'

export function ProjectDetailPage() {
  const { projectId, cardId } = useParams<{ projectId: string; cardId?: string }>()
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
      <nav className={styles.breadcrumb} aria-label="Navegação">
        <Link to={ROUTES.projects}>Projetos</Link>
        {project ? (
          <>
            <span aria-hidden="true">/</span>
            <span className={styles.breadcrumbCurrent}>{project.name}</span>
          </>
        ) : null}
      </nav>

      {isLoading ? <StatusMessage variant="loading" title="Carregando projeto…" /> : null}

      {isError ? <StatusMessage variant="error" title="Não foi possível carregar o projeto." /> : null}

      {!isLoading && !isError && project ? (
        <>
          <ProjectPageHeader project={project} active="kanban" />

          <ProjectBoard
            projectId={project.id}
            {...(cardId ? { openCardId: cardId } : {})}
            canManage={canManage}
            canManageCards={canManageCards}
            isReadOnly={project.status === 'ARCHIVED'}
          />
        </>
      ) : null}
    </section>
  )
}

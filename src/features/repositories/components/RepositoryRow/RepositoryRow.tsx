import { REPOSITORY_KIND_LABELS } from '@/features/repositories/types'
import type { GitRepository } from '@/features/repositories/types'
import { StatusBadge } from '@/shared/components/StatusBadge/StatusBadge'
import styles from './RepositoryRow.module.css'

const SCP_LIKE_SSH = /^[A-Za-z0-9_.-]+@[A-Za-z0-9_.-]+:/

function isLinkable(remoteUrl: string): boolean {
  return /^https?:\/\//i.test(remoteUrl)
}

function displayUrl(remoteUrl: string): string {
  return remoteUrl.replace(/^https?:\/\//i, '')
}

interface Props {
  repository: GitRepository
  canManage: boolean
  onEdit: () => void
  onArchive: () => void
  onReactivate: () => void
}

export function RepositoryRow({ repository, canManage, onEdit, onArchive, onReactivate }: Props) {
  const linkable = isLinkable(repository.remoteUrl)
  const sshShorthand = SCP_LIKE_SSH.test(repository.remoteUrl)

  return (
    <article className={styles.row} data-status={repository.status}>
      <div className={styles.main}>
        <div className={styles.header}>
          <h3 className={styles.name}>{repository.name}</h3>
          <span className={styles.kind}>{REPOSITORY_KIND_LABELS[repository.kind]}</span>
          <StatusBadge status={repository.status} />
        </div>

        {repository.description ? <p className={styles.description}>{repository.description}</p> : null}

        <dl className={styles.details}>
          <div className={styles.detail}>
            <dt>URL</dt>
            <dd>
              {linkable ? (
                <a
                  className={styles.remoteUrlLink}
                  href={repository.remoteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {displayUrl(repository.remoteUrl)}
                </a>
              ) : (
                <span className={styles.remoteUrlText} title={sshShorthand ? 'Endereço SSH' : undefined}>
                  {repository.remoteUrl}
                </span>
              )}
            </dd>
          </div>
          <div className={styles.detail}>
            <dt>Branch padrão</dt>
            <dd>
              <code className={styles.branch}>{repository.defaultBranch}</code>
            </dd>
          </div>
        </dl>
      </div>

      {canManage ? (
        <div className={styles.actions}>
          <button type="button" className={styles.actionButton} onClick={onEdit}>
            Editar
          </button>
          {repository.status === 'ACTIVE' ? (
            <button type="button" className={styles.actionButton} onClick={onArchive}>
              Arquivar
            </button>
          ) : (
            <button type="button" className={styles.actionButton} onClick={onReactivate}>
              Reativar
            </button>
          )}
        </div>
      ) : null}
    </article>
  )
}

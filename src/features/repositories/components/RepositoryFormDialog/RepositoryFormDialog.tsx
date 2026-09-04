import { useEffect, useRef, useState, type FormEvent } from 'react'
import { REPOSITORY_KIND_LABELS, REPOSITORY_KIND_OPTIONS } from '@/features/repositories/types'
import type { GitRepository, RepositoryKind } from '@/features/repositories/types'
import styles from './RepositoryFormDialog.module.css'

interface Props {
  mode: 'create' | 'edit'
  open: boolean
  repository?: GitRepository | null
  isSubmitting: boolean
  errorMessage: string | null
  onSubmit: (values: {
    name: string
    description: string
    kind: RepositoryKind
    remoteUrl: string
    defaultBranch: string
  }) => void
  onClose: () => void
}

function validateName(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'Nome é obrigatório.'
  if (trimmed.length > 150) return 'Nome deve ter no máximo 150 caracteres.'
  return null
}

function validateRemoteUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'URL do repositório é obrigatória.'
  return null
}

export function RepositoryFormDialog({ mode, open, repository, isSubmitting, errorMessage, onSubmit, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<RepositoryKind>('BACKEND')
  const [remoteUrl, setRemoteUrl] = useState('')
  const [defaultBranch, setDefaultBranch] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [remoteUrlError, setRemoteUrlError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      setName(mode === 'edit' ? (repository?.name ?? '') : '')
      setDescription(mode === 'edit' ? (repository?.description ?? '') : '')
      setKind(mode === 'edit' ? (repository?.kind ?? 'BACKEND') : 'BACKEND')
      setRemoteUrl(mode === 'edit' ? (repository?.remoteUrl ?? '') : '')
      setDefaultBranch(mode === 'edit' ? (repository?.defaultBranch ?? '') : '')
      setNameError(null)
      setRemoteUrlError(null)
      dialog.showModal()
    }
    if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, mode, repository])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextNameError = validateName(name)
    const nextRemoteUrlError = validateRemoteUrl(remoteUrl)
    setNameError(nextNameError)
    setRemoteUrlError(nextRemoteUrlError)
    if (nextNameError || nextRemoteUrlError) {
      return
    }
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      kind,
      remoteUrl: remoteUrl.trim(),
      defaultBranch: defaultBranch.trim(),
    })
  }

  return (
    <dialog ref={dialogRef} className={styles.dialog} onCancel={onClose}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h2 className={styles.title}>{mode === 'create' ? 'Novo repositório' : 'Editar repositório'}</h2>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="repository-name">
            Nome
          </label>
          <input
            id="repository-name"
            className={styles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isSubmitting}
            autoFocus
          />
          {nameError ? (
            <p className={styles.fieldError} role="alert">
              {nameError}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="repository-description">
            Descrição
          </label>
          <textarea
            id="repository-description"
            className={styles.textarea}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={isSubmitting}
            rows={3}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="repository-kind">
            Tipo
          </label>
          <select
            id="repository-kind"
            className={styles.select}
            value={kind}
            onChange={(event) => setKind(event.target.value as RepositoryKind)}
            disabled={isSubmitting}
          >
            {REPOSITORY_KIND_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {REPOSITORY_KIND_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="repository-remote-url">
            URL do repositório
          </label>
          <input
            id="repository-remote-url"
            className={styles.input}
            value={remoteUrl}
            onChange={(event) => setRemoteUrl(event.target.value)}
            disabled={isSubmitting}
            placeholder="https://github.com/org/repo.git"
          />
          {remoteUrlError ? (
            <p className={styles.fieldError} role="alert">
              {remoteUrlError}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="repository-default-branch">
            Branch padrão
          </label>
          <input
            id="repository-default-branch"
            className={styles.input}
            value={defaultBranch}
            onChange={(event) => setDefaultBranch(event.target.value)}
            disabled={isSubmitting}
            placeholder="main"
          />
          {mode === 'create' ? <p className={styles.hint}>Em branco, assume "main".</p> : null}
        </div>

        {errorMessage ? (
          <p className={styles.formError} role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </button>
          <button type="submit" className={styles.submit} disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </dialog>
  )
}

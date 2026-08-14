import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { labelApi } from '@/features/label/api/labelApi'
import { LabelBadge } from '@/features/label/components/LabelBadge/LabelBadge'
import { LabelColorPicker } from '@/features/label/components/LabelColorPicker/LabelColorPicker'
import { DEFAULT_LABEL_COLOR } from '@/features/label/constants'
import type { Label } from '@/features/label/types'
import { ApiError } from '@/shared/api/apiError'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/ConfirmDialog'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './LabelManagementDialog.module.css'

interface Props {
  open: boolean
  projectId: string
  onClose: () => void
}

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

/** Catálogo de Labels do Project — só ADMIN/PROJECT_MANAGER chegam aqui (ver trigger no
 * ProjectBoard); DEVELOPER/VIEWER usam o catálogo somente para associar, dentro do Card. */
export function LabelManagementDialog({ open, projectId, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(DEFAULT_LABEL_COLOR)
  const [pendingDeletion, setPendingDeletion] = useState<Label | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
    }
    if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const {
    data: labels,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => labelApi.list(projectId),
    enabled: open,
  })

  function invalidateDependents() {
    queryClient.invalidateQueries({ queryKey: ['labels', projectId] })
    queryClient.invalidateQueries({ queryKey: ['cards', projectId] })
    // Prefixo ['card'] casa qualquer detalhe de Card aberto (['card', cardId]) — o snapshot
    // {id,name,color} embutido no CardResponse fica desatualizado até esse refetch.
    queryClient.invalidateQueries({ queryKey: ['card'] })
  }

  const createMutation = useMutation({
    mutationFn: () => labelApi.create(projectId, { name: newName.trim(), color: newColor }),
    onSuccess: () => {
      invalidateDependents()
      setNewName('')
      setNewColor(DEFAULT_LABEL_COLOR)
      setError(null)
    },
    onError: (err: unknown) => setError(errorMessageFrom(err)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ labelId, name, color }: { labelId: string; name: string; color: string }) =>
      labelApi.update(projectId, labelId, { name, color }),
    onSuccess: () => {
      invalidateDependents()
      setEditingId(null)
      setError(null)
    },
    onError: (err: unknown) => setError(errorMessageFrom(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (labelId: string) => labelApi.remove(projectId, labelId),
    onSuccess: () => {
      invalidateDependents()
      setPendingDeletion(null)
      setError(null)
    },
    onError: (err: unknown) => {
      setError(errorMessageFrom(err))
      setPendingDeletion(null)
    },
  })

  function startEdit(label: Label) {
    setError(null)
    setEditingId(label.id)
    setEditName(label.name)
    setEditColor(label.color)
  }

  function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingId || !editName.trim()) return
    updateMutation.mutate({ labelId: editingId, name: editName.trim(), color: editColor })
  }

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newName.trim()) return
    createMutation.mutate()
  }

  return (
    <dialog ref={dialogRef} className={styles.dialog} onCancel={onClose}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h2 className={styles.title}>Labels do Projeto</h2>
          <button type="button" className={styles.close} onClick={onClose}>
            Fechar
          </button>
        </div>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        {isLoading ? <StatusMessage variant="loading" title="Carregando labels…" /> : null}
        {isError ? <StatusMessage variant="error" title="Não foi possível carregar as labels." /> : null}

        {!isLoading && !isError && labels && labels.length === 0 ? (
          <p className={styles.emptyState}>Nenhuma label cadastrada. Crie labels para organizar os cards.</p>
        ) : null}

        {!isLoading && !isError && labels && labels.length > 0 ? (
          <ul className={styles.list} aria-label="Labels do projeto">
            {labels.map((label) =>
              editingId === label.id ? (
                <li key={label.id} className={styles.row}>
                  <form className={styles.editForm} onSubmit={handleEditSubmit}>
                    <input
                      className={styles.nameInput}
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      aria-label="Nome da label"
                      autoFocus
                    />
                    <LabelColorPicker value={editColor} onChange={setEditColor} disabled={updateMutation.isPending} />
                    <div className={styles.editActions}>
                      <button type="submit" className={styles.save} disabled={updateMutation.isPending || !editName.trim()}>
                        Salvar
                      </button>
                      <button type="button" className={styles.cancelEdit} onClick={() => setEditingId(null)}>
                        Cancelar
                      </button>
                    </div>
                  </form>
                </li>
              ) : (
                <li key={label.id} className={styles.row}>
                  <LabelBadge name={label.name} color={label.color} />
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => startEdit(label)}
                      aria-label={`Editar label ${label.name}`}
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => setPendingDeletion(label)}
                      aria-label={`Excluir label ${label.name}`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ),
            )}
          </ul>
        ) : null}

        <form className={styles.createForm} onSubmit={handleCreateSubmit}>
          <span className={styles.createTitle}>Criar Label</span>
          <input
            className={styles.nameInput}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Nome da label…"
            aria-label="Nome da nova label"
            disabled={createMutation.isPending}
          />
          <LabelColorPicker value={newColor} onChange={setNewColor} disabled={createMutation.isPending} />
          <button type="submit" className={styles.create} disabled={createMutation.isPending || !newName.trim()}>
            + Criar Label
          </button>
        </form>
      </div>

      <ConfirmDialog
        open={pendingDeletion !== null}
        title="Excluir label"
        description={
          pendingDeletion
            ? `Excluir "${pendingDeletion.name}"? Ela será removida de todos os cards que a utilizam — nenhum card será excluído.`
            : ''
        }
        confirmLabel="Excluir"
        isConfirming={deleteMutation.isPending}
        onConfirm={() => pendingDeletion && deleteMutation.mutate(pendingDeletion.id)}
        onCancel={() => setPendingDeletion(null)}
      />
    </dialog>
  )
}

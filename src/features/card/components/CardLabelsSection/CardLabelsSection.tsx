import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { cardLabelApi } from '@/features/card/api/cardLabelApi'
import type { Card, CardLabelSummary } from '@/features/card/types'
import { labelApi } from '@/features/label/api/labelApi'
import { LabelBadge } from '@/features/label/components/LabelBadge/LabelBadge'
import { LabelColorPicker } from '@/features/label/components/LabelColorPicker/LabelColorPicker'
import { DEFAULT_LABEL_COLOR } from '@/features/label/constants'
import { ApiError } from '@/shared/api/apiError'
import styles from './CardLabelsSection.module.css'

interface Props {
  cardId: string
  projectId: string
  labels: CardLabelSummary[]
  canAssign: boolean
  canManageCatalog: boolean
}

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

/**
 * Seletor de Labels do Card. Auto-contido como AcceptanceCriteriaSection (Prompt 10): aplica
 * optimistic update/rollback direto no cache ['card', cardId] e invalida ['cards', projectId] ao
 * final, para o resumo do KanbanCard no board não ficar desatualizado.
 */
export function CardLabelsSection({ cardId, projectId, labels, canAssign, canManageCatalog }: Props) {
  const queryClient = useQueryClient()
  const containerRef = useRef<HTMLDivElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [creatingInline, setCreatingInline] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(DEFAULT_LABEL_COLOR)
  const [error, setError] = useState<string | null>(null)

  const queryKey = ['card', cardId] as const

  const { data: catalog } = useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => labelApi.list(projectId),
    enabled: canAssign && pickerOpen,
  })

  useEffect(() => {
    if (!pickerOpen) return
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setPickerOpen(false)
        setCreatingInline(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPickerOpen(false)
        setCreatingInline(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [pickerOpen])

  function patchCardLabels(nextLabels: CardLabelSummary[]) {
    queryClient.setQueryData<Card>(queryKey, (current) => (current ? { ...current, labels: nextLabels } : current))
  }

  function invalidateCardsList() {
    return queryClient.invalidateQueries({ queryKey: ['cards', projectId] })
  }

  const assignMutation = useMutation({
    mutationFn: (labelId: string) => cardLabelApi.assign(cardId, labelId),
    onSuccess: (updatedLabels) => {
      patchCardLabels(updatedLabels)
      setError(null)
    },
    onError: (err: unknown) => setError(errorMessageFrom(err)),
    onSettled: invalidateCardsList,
  })

  const removeMutation = useMutation({
    mutationFn: (labelId: string) => cardLabelApi.remove(cardId, labelId),
    onMutate: (labelId: string) => {
      const previous = queryClient.getQueryData<Card>(queryKey)
      patchCardLabels(labels.filter((label) => label.id !== labelId))
      setError(null)
      return { previous }
    },
    onError: (err: unknown, _labelId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
      setError(errorMessageFrom(err))
    },
    onSettled: invalidateCardsList,
  })

  const createAndAssignMutation = useMutation({
    mutationFn: () => labelApi.create(projectId, { name: newName.trim(), color: newColor }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['labels', projectId] })
      assignMutation.mutate(created.id)
      setCreatingInline(false)
      setNewName('')
      setNewColor(DEFAULT_LABEL_COLOR)
    },
    onError: (err: unknown) => setError(errorMessageFrom(err)),
  })

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newName.trim()) return
    createAndAssignMutation.mutate()
  }

  function closePicker() {
    setPickerOpen(false)
    setCreatingInline(false)
    setSearch('')
  }

  const available = (catalog ?? []).filter(
    (label) =>
      !labels.some((assigned) => assigned.id === label.id) &&
      label.name.toLowerCase().includes(search.trim().toLowerCase()),
  )

  return (
    <section className={styles.section} ref={containerRef}>
      <h3 className={styles.title}>Labels</h3>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.badges}>
        {labels.length === 0 && !canAssign ? <span className={styles.emptyState}>Nenhuma label</span> : null}
        {labels.map((label) => (
          <LabelBadge
            key={label.id}
            name={label.name}
            color={label.color}
            {...(canAssign ? { onRemove: () => removeMutation.mutate(label.id) } : {})}
          />
        ))}
        {canAssign ? (
          <button
            type="button"
            className={styles.addButton}
            onClick={() => setPickerOpen((current) => !current)}
            aria-label="Adicionar label"
            aria-expanded={pickerOpen}
          >
            <Plus size={12} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {pickerOpen ? (
        <div className={styles.picker} role="dialog" aria-label="Adicionar label">
          {!creatingInline ? (
            <>
              <input
                className={styles.search}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar label…"
                aria-label="Buscar label"
                autoFocus
              />
              <ul className={styles.options}>
                {available.map((label) => (
                  <li key={label.id}>
                    <button
                      type="button"
                      className={styles.option}
                      onClick={() => {
                        assignMutation.mutate(label.id)
                        setSearch('')
                      }}
                    >
                      <LabelBadge name={label.name} color={label.color} />
                    </button>
                  </li>
                ))}
                {available.length === 0 ? <li className={styles.noOptions}>Nenhuma label disponível.</li> : null}
              </ul>
              {canManageCatalog ? (
                <button type="button" className={styles.createInlineButton} onClick={() => setCreatingInline(true)}>
                  <Plus size={12} aria-hidden="true" />
                  Criar nova label
                </button>
              ) : null}
              <button type="button" className={styles.closePicker} onClick={closePicker}>
                Fechar
              </button>
            </>
          ) : (
            <form className={styles.inlineCreateForm} onSubmit={handleCreateSubmit}>
              <input
                className={styles.search}
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Nome da nova label…"
                aria-label="Nome da nova label"
                autoFocus
              />
              <LabelColorPicker value={newColor} onChange={setNewColor} disabled={createAndAssignMutation.isPending} />
              <div className={styles.inlineCreateActions}>
                <button
                  type="submit"
                  className={styles.save}
                  disabled={createAndAssignMutation.isPending || !newName.trim()}
                >
                  Criar e adicionar
                </button>
                <button type="button" className={styles.cancelEdit} onClick={() => setCreatingInline(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </section>
  )
}

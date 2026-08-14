import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X } from 'lucide-react'
import type { AcceptanceCriterion } from '@/features/card/types'
import styles from './AcceptanceCriteriaSection.module.css'

const DESCRIPTION_MIN_LENGTH = 3
const DESCRIPTION_MAX_LENGTH = 500

interface Props {
  criterion: AcceptanceCriterion
  canManage: boolean
  onToggle: () => void
  onUpdateDescription: (description: string) => void
  onDelete: () => void
}

export function SortableAcceptanceCriterionRow({ criterion, canManage, onToggle, onUpdateDescription, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: criterion.id,
    disabled: !canManage,
  })
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(criterion.description)

  function commitEdit() {
    setIsEditing(false)
    const trimmed = draft.trim()
    const isValid = trimmed.length >= DESCRIPTION_MIN_LENGTH && trimmed.length <= DESCRIPTION_MAX_LENGTH
    if (isValid && trimmed !== criterion.description) {
      onUpdateDescription(trimmed)
    } else {
      setDraft(criterion.description)
    }
  }

  return (
    <li
      ref={setNodeRef}
      data-criterion-id={criterion.id}
      data-dragging={isDragging}
      className={styles.row}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {canManage ? (
        <button type="button" className={styles.handle} aria-label="Reordenar critério" {...attributes} {...listeners}>
          <GripVertical size={14} aria-hidden="true" />
        </button>
      ) : null}

      <input
        type="checkbox"
        className={styles.checkbox}
        checked={criterion.completed}
        onChange={onToggle}
        disabled={!canManage}
        aria-label={
          criterion.completed ? `Reabrir critério: ${criterion.description}` : `Concluir critério: ${criterion.description}`
        }
      />

      {isEditing ? (
        <input
          className={styles.editInput}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitEdit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitEdit()
            }
            if (event.key === 'Escape') {
              setDraft(criterion.description)
              setIsEditing(false)
            }
          }}
          aria-label="Editar descrição do critério"
          autoFocus
        />
      ) : canManage ? (
        <button
          type="button"
          className={styles.description}
          data-completed={criterion.completed}
          onClick={() => setIsEditing(true)}
        >
          {criterion.description}
        </button>
      ) : (
        <span className={styles.description} data-completed={criterion.completed}>
          {criterion.description}
        </span>
      )}

      {canManage ? (
        <button type="button" className={styles.delete} onClick={onDelete} aria-label="Remover critério">
          <X size={14} aria-hidden="true" />
        </button>
      ) : null}
    </li>
  )
}

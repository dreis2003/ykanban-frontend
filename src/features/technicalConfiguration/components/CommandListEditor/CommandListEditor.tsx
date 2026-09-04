import { Plus, Trash2 } from 'lucide-react'
import { COMMAND_KIND_LABELS, COMMAND_KIND_OPTIONS } from '@/features/technicalConfiguration/types'
import type { CommandKind, RepositoryCommand } from '@/features/technicalConfiguration/types'
import styles from './CommandListEditor.module.css'

interface Props {
  commands: RepositoryCommand[]
  disabled: boolean
  onChange: (commands: RepositoryCommand[]) => void
}

function firstUnusedKind(commands: RepositoryCommand[]): CommandKind | null {
  const used = new Set(commands.map((command) => command.kind))
  return COMMAND_KIND_OPTIONS.find((kind) => !used.has(kind)) ?? null
}

/** Edita a lista completa de comandos de uma configuração técnica — cada `CommandKind` só pode
 * aparecer uma vez (Prompt 33); o seletor de tipo de cada linha já esconde os tipos usados pelas
 * demais linhas, então a UI torna a duplicidade impossível em vez de só validar depois do envio. */
export function CommandListEditor({ commands, disabled, onChange }: Props) {
  const nextKind = firstUnusedKind(commands)

  function updateCommand(index: number, patch: Partial<RepositoryCommand>) {
    onChange(commands.map((command, i) => (i === index ? { ...command, ...patch } : command)))
  }

  function removeCommand(index: number) {
    onChange(commands.filter((_, i) => i !== index))
  }

  function addCommand() {
    if (!nextKind) return
    onChange([...commands, { kind: nextKind, command: '', description: null }])
  }

  function availableKindsFor(currentKind: CommandKind): CommandKind[] {
    const usedByOthers = new Set(commands.filter((c) => c.kind !== currentKind).map((c) => c.kind))
    return COMMAND_KIND_OPTIONS.filter((kind) => kind === currentKind || !usedByOthers.has(kind))
  }

  return (
    <div className={styles.editor}>
      {commands.length === 0 ? <p className={styles.empty}>Nenhum comando configurado.</p> : null}

      {commands.map((command, index) => (
        <div key={`${command.kind}-${index}`} className={styles.row}>
          <select
            className={styles.kindSelect}
            value={command.kind}
            disabled={disabled}
            aria-label="Tipo do comando"
            onChange={(event) => updateCommand(index, { kind: event.target.value as CommandKind })}
          >
            {availableKindsFor(command.kind).map((kind) => (
              <option key={kind} value={kind}>
                {COMMAND_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
          <input
            className={styles.commandInput}
            value={command.command}
            disabled={disabled}
            placeholder="./mvnw test"
            aria-label="Comando"
            onChange={(event) => updateCommand(index, { command: event.target.value })}
          />
          <input
            className={styles.descriptionInput}
            value={command.description ?? ''}
            disabled={disabled}
            placeholder="Descrição (opcional)"
            aria-label="Descrição do comando"
            onChange={(event) => updateCommand(index, { description: event.target.value || null })}
          />
          <button
            type="button"
            className={styles.removeButton}
            disabled={disabled}
            onClick={() => removeCommand(index)}
            aria-label={`Remover comando ${COMMAND_KIND_LABELS[command.kind]}`}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      ))}

      {nextKind ? (
        <button type="button" className={styles.addButton} disabled={disabled} onClick={addCommand}>
          <Plus size={16} aria-hidden="true" />
          Adicionar comando
        </button>
      ) : null}
    </div>
  )
}

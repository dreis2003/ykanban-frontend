import { getContrastTextColor } from '@/features/label/utils/contrastColor'
import { getAvatarColor } from '@/features/user/utils/avatarColor'
import { getInitials } from '@/features/user/utils/initials'
import type { UserStatus } from '@/features/user/types'
import styles from './UserAvatar.module.css'

interface Props {
  id: string
  name: string
  status?: UserStatus
}

/** Iniciais + cor derivada do id — nunca depende de upload/foto (ver Prompt 12). */
export function UserAvatar({ id, name, status }: Props) {
  const color = getAvatarColor(id)
  const label = status === 'INACTIVE' ? `${name} (inativo)` : name

  return (
    <span
      className={styles.avatar}
      style={{ backgroundColor: color, color: getContrastTextColor(color) }}
      role="img"
      aria-label={label}
      title={label}
      data-inactive={status === 'INACTIVE' ? 'true' : undefined}
    >
      {getInitials(name)}
    </span>
  )
}

import { ROUTES } from '@/app/router/routes'

const UUID_SEGMENT = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'

const SAFE_RETURN_TO_PATTERNS: RegExp[] = [
  /^\/projects$/,
  new RegExp(`^/projects/${UUID_SEGMENT}$`),
  new RegExp(`^/projects/${UUID_SEGMENT}/dashboard$`),
  new RegExp(`^/projects/${UUID_SEGMENT}/cards/${UUID_SEGMENT}$`),
]

/**
 * Allow-list estrita para o parâmetro `returnTo` da navegação de Membros (ver ADR 0025, item 199)
 * — bloqueia open-redirect (`https://evil.com`) e URLs protocol-relative (`//evil.com`) por
 * construção, já que só aceita valores que batem EXATAMENTE com uma das rotas internas conhecidas
 * do shell autenticado. Nunca usar `window.history.back()` como substituto: ele não sobrevive a
 * reload de página nem a navegação direta via link.
 */
export function isSafeReturnTo(value: string | null | undefined): value is string {
  if (!value) return false
  return SAFE_RETURN_TO_PATTERNS.some((pattern) => pattern.test(value))
}

export interface ReturnToTarget {
  to: string
  label: string
}

/** Resolve alvo e rótulo do link de "voltar" a partir de um `returnTo` bruto — cai em
 * `/projects` sempre que o valor for ausente ou não bater no allow-list. */
export function resolveReturnTo(value: string | null | undefined): ReturnToTarget {
  if (!isSafeReturnTo(value) || value === ROUTES.projects) {
    return { to: ROUTES.projects, label: 'Voltar para Projetos' }
  }
  if (value.endsWith('/dashboard')) {
    return { to: value, label: 'Voltar ao Dashboard' }
  }
  return { to: value, label: 'Voltar ao Kanban' }
}

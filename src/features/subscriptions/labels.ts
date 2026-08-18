import type { LimitKey } from '@/features/entitlements/types'

export const LIMIT_LABELS: Record<LimitKey, string> = {
  MAX_MEMBERS: 'Usuários',
  MAX_PROJECTS: 'Projetos',
}

export const FEATURE_LABELS: Record<string, string> = {
  GITHUB_INTEGRATION: 'Integração com GitHub',
  AI_AGENTS: 'Agentes de IA',
  ADVANCED_ANALYTICS: 'Analytics avançado',
}

export function featureLabel(key: string): string {
  return FEATURE_LABELS[key] ?? key
}

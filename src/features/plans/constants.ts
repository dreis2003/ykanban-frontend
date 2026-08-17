import type { FeatureKey, LimitKey } from '@/features/plans/types'

/** Catálogo fechado de Features — espelha o enum {@code FeatureKey} do backend (ver ADR 0025).
 * Rótulos aqui são só apresentação; a lista de chaves válidas é sempre a do backend
 * (`GET /platform/entitlements/features`), nunca esta constante. */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  GITHUB_INTEGRATION: 'Integração com GitHub',
  AI_AGENTS: 'Agentes de IA',
  ADVANCED_ANALYTICS: 'Analytics avançado',
}

export const LIMIT_LABELS: Record<LimitKey, string> = {
  MAX_MEMBERS: 'Máximo de membros',
  MAX_PROJECTS: 'Máximo de projetos',
}

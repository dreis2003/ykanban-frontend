export interface YCommunicationIntegration {
  configured: boolean
  id?: string
  baseUrl?: string
  maskedApiKey?: string
  active: boolean
  updatedAt?: string
}

export interface SaveIntegrationPayload {
  apiKey?: string | undefined
  active: boolean
}

export interface TestConnectionPayload {
  apiKey?: string | undefined
}

export interface TestConnectionResponse {
  success: boolean
  applicationName?: string | undefined
  companyName?: string | undefined
  scopes: string[]
  errorMessage?: string | undefined
}

export type DeliveryReceiptStatus = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'DEAD_LETTER'

export interface DeliveryReceiptConfig {
  configured: boolean
  callbackPublicId?: string
  callbackUrl?: string
  signingSecretConfigured: boolean
  secretRotatedAt?: string
}

export interface SetDeliveryReceiptSigningSecretPayload {
  signingSecret: string
}

export type CommunicationChannel = 'EMAIL' | 'TELEGRAM' | 'WHATSAPP' | 'WEBHOOK'

export type NotificationEvent = 'CARD_CREATED' | 'CARD_MOVED' | 'CARD_COMPLETED'

export interface ProjectNotificationDestination {
  id: string
  projectId: string
  channel: CommunicationChannel
  recipientPayload: string
  events: NotificationEvent[]
  active: boolean
  updatedAt: string
}

export interface SaveDestinationPayload {
  channel: CommunicationChannel
  recipientPayload: string
  events: NotificationEvent[]
  active: boolean
}

// Prompt 33.1 — Tenant defaults + Project overrides de canal de comunicação. Distinto dos
// "Destinos de Notificação" acima: aquele responde "PARA ONDE enviar" (um e-mail, um chatId, um
// número, uma URL); isto responde "COM QUAL configuração do YCommunication enviar" (ex.: qual das
// duas contas de e-mail cadastradas na empresa).

export type ChannelAvailability =
  | 'AVAILABLE'
  | 'UNCONFIGURED'
  | 'CONFIGURED_BUT_UNAVAILABLE'
  | 'INTEGRATION_DISABLED'
  | 'CONNECTION_ERROR'

export type EffectiveChannelSource = 'TENANT' | 'PROJECT' | 'DISABLED' | 'UNCONFIGURED'

export type ChannelPreferenceMode = 'INHERIT' | 'OVERRIDE' | 'DISABLED'

export interface ChannelCatalogEntry {
  id: string
  channelType: CommunicationChannel
  name: string
  displayName: string
  active: boolean
}

export interface ChannelSummary {
  id: string
  displayName: string
  availability: ChannelAvailability
}

export interface TenantChannelPreference {
  channelType: CommunicationChannel
  channel: ChannelSummary | null
  availability: ChannelAvailability
}

export interface SetTenantChannelPreferencePayload {
  channelConfigurationId: string
}

export interface ProjectChannelPreference {
  channelType: CommunicationChannel
  mode: ChannelPreferenceMode
  tenantDefault: ChannelSummary | null
  projectOverride: ChannelSummary | null
  effectiveChannel: ChannelSummary | null
  effectiveSource: EffectiveChannelSource
  availability: ChannelAvailability | null
}

export interface SetProjectChannelPreferencePayload {
  mode: ChannelPreferenceMode
  channelConfigurationId?: string
}

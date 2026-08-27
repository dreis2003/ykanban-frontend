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

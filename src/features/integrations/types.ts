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

export type TemplateVariableType = 'STRING' | 'NUMBER' | 'BOOLEAN'

export interface NotificationTemplateVariable {
  path: string
  type: TemplateVariableType
  required: boolean
  description?: string | null
}

export interface NotificationTemplateCatalogItem {
  code: string
  name: string
  description?: string | null
  channel: CommunicationChannel
  version: number
  variables: NotificationTemplateVariable[]
}

export interface ProjectNotificationEventTemplate {
  id: string
  projectId: string
  eventType: NotificationEvent
  channel: CommunicationChannel
  templateCode: string
  updatedAt: string
}

export interface SaveProjectNotificationEventTemplatePayload {
  eventType: NotificationEvent
  channel: CommunicationChannel
  templateCode: string
}

export type NotificationPolicyMode = 'FAN_OUT' | 'FALLBACK'

/** Contrato de variável de uma Notification Policy (YCOM-018) — usa `name`, não `path`: um
 * contrato público deliberadamente distinto do catálogo de Template (YCOM-017), pois o consumidor
 * nunca sabe qual Route/Template concreto vai renderizar cada variável. */
export interface NotificationPolicyVariable {
  name: string
  type: TemplateVariableType
  required: boolean
}

export interface NotificationPolicyCatalogItem {
  code: string
  name: string
  description?: string | null
  mode: NotificationPolicyMode
  variables: NotificationPolicyVariable[]
}

export interface ProjectNotificationEventPolicy {
  id: string
  projectId: string
  eventType: NotificationEvent
  policyCode: string
  enabled: boolean
  updatedAt: string
}

export interface SaveProjectNotificationEventPolicyPayload {
  eventType: NotificationEvent
  policyCode: string
}

import { httpClient } from '@/shared/api/httpClient'
import type { PageResponse } from '@/shared/types/pageResponse'
import type {
  DeliveryReceiptConfig,
  NotificationPolicyCatalogItem,
  NotificationTemplateCatalogItem,
  ProjectNotificationDestination,
  ProjectNotificationEventPolicy,
  ProjectNotificationEventTemplate,
  RecipientCatalogItem,
  SaveDestinationPayload,
  SaveIntegrationPayload,
  SaveProjectNotificationEventPolicyPayload,
  SaveProjectNotificationEventTemplatePayload,
  SetDeliveryReceiptSigningSecretPayload,
  TestConnectionPayload,
  TestConnectionResponse,
  YCommunicationIntegration,
} from '@/features/integrations/types'

export const integrationsApi = {
  getIntegration: () =>
    httpClient.get<YCommunicationIntegration>('/tenants/current/integrations/ycommunication'),

  saveIntegration: (payload: SaveIntegrationPayload) =>
    httpClient.put<YCommunicationIntegration>('/tenants/current/integrations/ycommunication', payload),

  testConnection: (payload: TestConnectionPayload) =>
    httpClient.post<TestConnectionResponse>('/tenants/current/integrations/ycommunication/test', payload),

  getDeliveryReceiptConfig: () =>
    httpClient.get<DeliveryReceiptConfig>('/tenants/current/integrations/ycommunication/delivery-receipts'),

  setDeliveryReceiptSigningSecret: (payload: SetDeliveryReceiptSigningSecretPayload) =>
    httpClient.put<DeliveryReceiptConfig>(
      '/tenants/current/integrations/ycommunication/delivery-receipts/signing-secret',
      payload
    ),

  listDestinations: (projectId: string) =>
    httpClient.get<ProjectNotificationDestination[]>(`/projects/${projectId}/notification-destinations`),

  createDestination: (projectId: string, payload: SaveDestinationPayload) =>
    httpClient.post<ProjectNotificationDestination>(`/projects/${projectId}/notification-destinations`, payload),

  updateDestination: (projectId: string, destinationId: string, payload: SaveDestinationPayload) =>
    httpClient.put<ProjectNotificationDestination>(
      `/projects/${projectId}/notification-destinations/${destinationId}`,
      payload
    ),

  deleteDestination: (projectId: string, destinationId: string) =>
    httpClient.delete<void>(`/projects/${projectId}/notification-destinations/${destinationId}`),

  listTemplateCatalog: () =>
    httpClient.get<NotificationTemplateCatalogItem[]>('/tenants/current/integrations/ycommunication/templates'),

  listProjectEventTemplates: (projectId: string) =>
    httpClient.get<ProjectNotificationEventTemplate[]>(`/projects/${projectId}/notification-templates`),

  saveProjectEventTemplate: (projectId: string, payload: SaveProjectNotificationEventTemplatePayload) =>
    httpClient.put<ProjectNotificationEventTemplate>(`/projects/${projectId}/notification-templates`, payload),

  deleteProjectEventTemplate: (projectId: string, eventType: string, channel: string) =>
    httpClient.delete<void>(
      `/projects/${projectId}/notification-templates?eventType=${encodeURIComponent(eventType)}&channel=${encodeURIComponent(channel)}`
    ),

  listNotificationPolicyCatalog: () =>
    httpClient.get<NotificationPolicyCatalogItem[]>('/tenants/current/integrations/ycommunication/notification-policies'),

  listProjectEventPolicies: (projectId: string) =>
    httpClient.get<ProjectNotificationEventPolicy[]>(`/projects/${projectId}/notification-event-policies`),

  saveProjectEventPolicy: (projectId: string, payload: SaveProjectNotificationEventPolicyPayload) =>
    httpClient.put<ProjectNotificationEventPolicy>(`/projects/${projectId}/notification-event-policies`, payload),

  deleteProjectEventPolicy: (projectId: string, eventType: string) =>
    httpClient.delete<void>(`/projects/${projectId}/notification-event-policies?eventType=${encodeURIComponent(eventType)}`),

  listRecipientCatalog: (params: { page?: number; size?: number; q?: string } = {}) => {
    const query = new URLSearchParams()
    query.set('page', String(params.page ?? 0))
    query.set('size', String(params.size ?? 20))
    if (params.q) {
      query.set('q', params.q)
    }
    return httpClient.get<PageResponse<RecipientCatalogItem>>(
      `/tenants/current/integrations/ycommunication/recipients?${query.toString()}`,
    )
  },
}

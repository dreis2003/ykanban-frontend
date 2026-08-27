import { httpClient } from '@/shared/api/httpClient'
import type {
  DeliveryReceiptConfig,
  NotificationTemplateCatalogItem,
  ProjectNotificationDestination,
  ProjectNotificationEventTemplate,
  SaveDestinationPayload,
  SaveIntegrationPayload,
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
}

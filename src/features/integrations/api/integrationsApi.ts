import { httpClient } from '@/shared/api/httpClient'
import type {
  ProjectNotificationDestination,
  SaveDestinationPayload,
  SaveIntegrationPayload,
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
}

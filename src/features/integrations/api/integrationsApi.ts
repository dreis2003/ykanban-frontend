import { httpClient } from '@/shared/api/httpClient'
import type {
  ChannelCatalogEntry,
  CommunicationChannel,
  DeliveryReceiptConfig,
  ProjectChannelPreference,
  ProjectNotificationDestination,
  SaveDestinationPayload,
  SaveIntegrationPayload,
  SetDeliveryReceiptSigningSecretPayload,
  SetProjectChannelPreferencePayload,
  SetTenantChannelPreferencePayload,
  TenantChannelPreference,
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

  listChannelCatalog: (type?: CommunicationChannel) =>
    httpClient.get<ChannelCatalogEntry[]>(
      `/tenants/current/integrations/ycommunication/channels${type ? `?type=${type}` : ''}`
    ),

  listChannelPreferences: () =>
    httpClient.get<TenantChannelPreference[]>(
      '/tenants/current/integrations/ycommunication/channel-preferences'
    ),

  setChannelPreference: (channelType: CommunicationChannel, payload: SetTenantChannelPreferencePayload) =>
    httpClient.put<TenantChannelPreference>(
      `/tenants/current/integrations/ycommunication/channel-preferences/${channelType}`,
      payload
    ),

  clearChannelPreference: (channelType: CommunicationChannel) =>
    httpClient.delete<void>(`/tenants/current/integrations/ycommunication/channel-preferences/${channelType}`),

  listProjectChannels: (projectId: string) =>
    httpClient.get<ProjectChannelPreference[]>(`/projects/${projectId}/communication-channels`),

  setProjectChannelPreference: (
    projectId: string,
    channelType: CommunicationChannel,
    payload: SetProjectChannelPreferencePayload
  ) =>
    httpClient.put<ProjectChannelPreference>(
      `/projects/${projectId}/communication-channels/${channelType}`,
      payload
    ),
}

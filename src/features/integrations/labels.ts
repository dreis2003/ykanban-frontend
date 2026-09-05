import type { ChannelAvailability, CommunicationChannel } from '@/features/integrations/types'

const CHANNEL_TYPE_LABELS: Record<CommunicationChannel, string> = {
  EMAIL: 'E-mail',
  TELEGRAM: 'Telegram',
  WHATSAPP: 'WhatsApp',
  WEBHOOK: 'Webhook',
}

export function channelTypeLabel(channelType: CommunicationChannel): string {
  return CHANNEL_TYPE_LABELS[channelType] ?? channelType
}

const AVAILABILITY_LABELS: Record<ChannelAvailability, string> = {
  AVAILABLE: 'Ativo',
  UNCONFIGURED: 'Nenhum canal configurado',
  CONFIGURED_BUT_UNAVAILABLE: 'Canal configurado indisponível no YCommunication',
  INTEGRATION_DISABLED: 'Integração YCommunication inativa',
  CONNECTION_ERROR: 'Não foi possível validar o canal no YCommunication',
}

/** {@code availability} vem sempre de um enum fechado do backend, mas o fallback nunca esconde a
 * UI caso um novo valor seja introduzido no backend antes do frontend. */
export function availabilityLabel(availability: ChannelAvailability): string {
  return AVAILABILITY_LABELS[availability] ?? availability
}

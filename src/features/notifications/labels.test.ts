import { describe, expect, it } from 'vitest'
import { dispatchStatusLabel, remoteStatusLabel } from '@/features/notifications/labels'

describe('dispatchStatusLabel', () => {
  it('maps known dispatch statuses', () => {
    expect(dispatchStatusLabel('PENDING')).toBe('Pendente')
    expect(dispatchStatusLabel('DISPATCHED')).toBe('Aceito pelo YCommunication')
    expect(dispatchStatusLabel('FAILED')).toBe('Falha ao enviar ao Hub')
    expect(dispatchStatusLabel('DEAD_LETTER')).toBe('Falha definitiva ao enviar ao Hub')
  })

  it('falls back to the raw value for an unknown status without breaking', () => {
    expect(dispatchStatusLabel('UNKNOWN_NEW_STATUS')).toBe('UNKNOWN_NEW_STATUS')
  })
})

describe('remoteStatusLabel', () => {
  it('shows "Aguardando atualização" for null (never "Falhou")', () => {
    expect(remoteStatusLabel(null)).toBe('Aguardando atualização')
  })

  it('maps known remote statuses', () => {
    expect(remoteStatusLabel('SENT')).toBe('Enviado')
    expect(remoteStatusLabel('DELIVERED')).toBe('Entregue')
    expect(remoteStatusLabel('READ')).toBe('Lido')
    expect(remoteStatusLabel('FAILED')).toBe('Falhou')
    expect(remoteStatusLabel('DEAD_LETTER')).toBe('Dead Letter')
  })

  it('falls back to the raw value for an unknown status without breaking', () => {
    expect(remoteStatusLabel('UNKNOWN_NEW_STATUS')).toBe('UNKNOWN_NEW_STATUS')
  })
})

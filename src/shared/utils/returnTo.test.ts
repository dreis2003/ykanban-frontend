import { describe, expect, it } from 'vitest'
import { isSafeReturnTo, resolveReturnTo } from './returnTo'

describe('isSafeReturnTo', () => {
  it('aceita caminhos internos conhecidos', () => {
    expect(isSafeReturnTo('/projects')).toBe(true)
    expect(isSafeReturnTo('/projects/11111111-1111-1111-1111-111111111111')).toBe(true)
    expect(isSafeReturnTo('/projects/11111111-1111-1111-1111-111111111111/dashboard')).toBe(true)
    expect(
      isSafeReturnTo(
        '/projects/11111111-1111-1111-1111-111111111111/cards/22222222-2222-2222-2222-222222222222',
      ),
    ).toBe(true)
  })

  it('rejeita ausência de valor', () => {
    expect(isSafeReturnTo(null)).toBe(false)
    expect(isSafeReturnTo(undefined)).toBe(false)
    expect(isSafeReturnTo('')).toBe(false)
  })

  it('rejeita URLs absolutas (open redirect)', () => {
    expect(isSafeReturnTo('https://evil.com')).toBe(false)
    expect(isSafeReturnTo('http://evil.com/projects')).toBe(false)
  })

  it('rejeita URLs protocol-relative', () => {
    expect(isSafeReturnTo('//evil.com')).toBe(false)
  })

  it('rejeita caminhos fora do allow-list', () => {
    expect(isSafeReturnTo('/settings/members')).toBe(false)
    expect(isSafeReturnTo('/platform/tenants')).toBe(false)
    expect(isSafeReturnTo('/projects/not-a-uuid')).toBe(false)
  })
})

describe('resolveReturnTo', () => {
  it('cai em Projetos quando o valor é ausente ou inválido', () => {
    expect(resolveReturnTo(null)).toEqual({ to: '/projects', label: 'Voltar para Projetos' })
    expect(resolveReturnTo('https://evil.com')).toEqual({ to: '/projects', label: 'Voltar para Projetos' })
  })

  it('resolve para "Voltar ao Dashboard" em rotas de dashboard', () => {
    const path = '/projects/11111111-1111-1111-1111-111111111111/dashboard'
    expect(resolveReturnTo(path)).toEqual({ to: path, label: 'Voltar ao Dashboard' })
  })

  it('resolve para "Voltar ao Kanban" em rotas de board/card', () => {
    const boardPath = '/projects/11111111-1111-1111-1111-111111111111'
    expect(resolveReturnTo(boardPath)).toEqual({ to: boardPath, label: 'Voltar ao Kanban' })

    const cardPath = '/projects/11111111-1111-1111-1111-111111111111/cards/22222222-2222-2222-2222-222222222222'
    expect(resolveReturnTo(cardPath)).toEqual({ to: cardPath, label: 'Voltar ao Kanban' })
  })

  it('resolve para "Voltar para Projetos" quando o valor já é /projects', () => {
    expect(resolveReturnTo('/projects')).toEqual({ to: '/projects', label: 'Voltar para Projetos' })
  })
})

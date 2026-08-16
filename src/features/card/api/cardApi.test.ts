import { afterEach, describe, expect, it, vi } from 'vitest'
import { cardApi } from '@/features/card/api/cardApi'

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
  } as Response
}

function stubFetchCapturingUrl(): { firstCallUrl: () => string } {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      calls.push(input.toString())
      return Promise.resolve(jsonResponse([]))
    }),
  )
  return {
    firstCallUrl: () => {
      const first = calls[0]
      if (!first) {
        throw new Error('fetch não foi chamado')
      }
      return first
    },
  }
}

describe('cardApi.list', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('faz a requisição sem query string quando nenhum critério é informado', async () => {
    const { firstCallUrl } = stubFetchCapturingUrl()

    await cardApi.list('p1')

    expect(firstCallUrl()).toMatch(/\/projects\/p1\/cards$/)
  })

  it('inclui search, types, priorities, labelIds e blocked combinados na query', async () => {
    const { firstCallUrl } = stubFetchCapturingUrl()

    await cardApi.list('p1', {
      search: 'login',
      types: ['BUG', 'FEATURE'],
      priorities: ['HIGH'],
      labelIds: ['l1', 'l2'],
      blocked: true,
    })

    const url = new URL(firstCallUrl())
    expect(url.pathname).toBe('/api/v1/projects/p1/cards')
    expect(url.searchParams.get('search')).toBe('login')
    expect(url.searchParams.get('types')).toBe('BUG,FEATURE')
    expect(url.searchParams.get('priorities')).toBe('HIGH')
    expect(url.searchParams.get('labelIds')).toBe('l1,l2')
    expect(url.searchParams.get('blocked')).toBe('true')
  })

  it('envia unassigned=true e nunca envia assigneeId junto', async () => {
    const { firstCallUrl } = stubFetchCapturingUrl()

    await cardApi.list('p1', { assigneeId: 'u1', unassigned: true })

    const url = new URL(firstCallUrl())
    expect(url.searchParams.get('unassigned')).toBe('true')
    expect(url.searchParams.has('assigneeId')).toBe(false)
  })

  it('envia assigneeId quando unassigned não está ativo', async () => {
    const { firstCallUrl } = stubFetchCapturingUrl()

    await cardApi.list('p1', { assigneeId: 'u1' })

    const url = new URL(firstCallUrl())
    expect(url.searchParams.get('assigneeId')).toBe('u1')
    expect(url.searchParams.has('unassigned')).toBe(false)
  })
})

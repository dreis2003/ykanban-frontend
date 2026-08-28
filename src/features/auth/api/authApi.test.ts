import { afterEach, describe, expect, it, vi } from 'vitest'
import { authApi } from '@/features/auth/api/authApi'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
  } as Response
}

describe('authApi.login', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('envia "senha" (não "password") para o backend, mantendo a assinatura em inglês', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ accessToken: 'token' }))

    await authApi.login('ana@ykanban.dev', 'secret')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0]
    expect(call).toBeDefined()
    const [url, init] = call!
    expect(String(url)).toContain('/auth/login')
    expect(JSON.parse(init?.body as string)).toEqual({
      email: 'ana@ykanban.dev',
      senha: 'secret',
    })
  })
})

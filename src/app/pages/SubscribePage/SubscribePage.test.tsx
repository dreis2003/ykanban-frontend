import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SubscribePage } from '@/app/pages/SubscribePage/SubscribePage'
import { AuthContext, type AuthContextValue } from '@/features/auth/AuthContext'
import { authSession } from '@/shared/api/authSession'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' }),
    json: () => Promise.resolve(body),
  } as Response
}

const PLANS = [
  {
    id: 'plan-1',
    code: 'PROFESSIONAL',
    name: 'Professional',
    description: 'Para times em crescimento.',
    prices: [
      { id: 'price-monthly', planId: 'plan-1', billingInterval: 'MONTHLY', currency: 'BRL', amountMinor: 9990, status: 'ACTIVE', displayOrder: 1, createdAt: '', updatedAt: '' },
    ],
  },
]

function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    activeTenant: null,
    membershipRole: null,
    membershipStatus: null,
    authenticationContext: null,
    platformRoles: [],
    availableTenants: [],
    isAuthenticated: false,
    isTenantSelected: false,
    isLoading: false,
    login: async () => undefined,
    selectTenant: async () => undefined,
    logout: async () => undefined,
    refreshAvailableTenants: async () => undefined,
    refreshSession: async () => 'TENANT_SELECTION',
    completeInvitationRegistration: async () => undefined,
    completeInvitationAcceptance: async () => undefined,
    ...overrides,
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue()}>
        <MemoryRouter initialEntries={['/subscribe']}>
          <Routes>
            <Route path="/subscribe" element={<SubscribePage />} />
            <Route path="/terms" element={<div>Termos</div>} />
            <Route path="/privacy" element={<div>Privacidade</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('SubscribePage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    authSession.setAccessToken(null)
  })

  it('lista os planos publicados sem exigir autenticação', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(PLANS))))

    renderPage()

    expect(await screen.findAllByText('Professional')).not.toHaveLength(0)
    expect(screen.getAllByText(/R\$\s*99,90/).length).toBeGreaterThan(0)
    expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument()
  })

  it('não permite continuar sem aceitar os Termos', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(PLANS))))

    renderPage()
    await screen.findAllByText('Professional')

    expect(screen.getByRole('button', { name: 'Continuar para pagamento' })).toBeDisabled()
  })

  it('envia apenas organizationName/email/slug/planPriceId/termsAccepted — nunca amount ou stripePriceId', async () => {
    const user = userEvent.setup()
    let capturedBody: unknown
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString()
        if (url.includes('/public/plans')) {
          return Promise.resolve(jsonResponse(PLANS))
        }
        if (url.includes('/public/subscription-signups')) {
          capturedBody = init?.body ? JSON.parse(init.body as string) : undefined
          return Promise.resolve(jsonResponse({ signupId: 's1', checkoutUrl: 'https://checkout.stripe.com/cs_123' }))
        }
        return Promise.reject(new Error(`fetch inesperado: ${url}`))
      }),
    )
    // window.location.href não é navegável no jsdom — só garantimos que a chamada foi feita.
    Object.defineProperty(window, 'location', { value: { ...window.location, href: '' }, writable: true })

    renderPage()
    await screen.findAllByText('Professional')

    await user.type(screen.getByLabelText('Nome da empresa'), 'Empresa ABC')
    await user.type(screen.getByLabelText('E-mail'), 'cliente@empresa.com')
    // Único plano disponível: já vem pré-selecionado, sem precisar clicar no card.
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Continuar para pagamento' }))

    await waitFor(() => expect(capturedBody).toBeDefined())
    expect(capturedBody).toMatchObject({
      organizationName: 'Empresa ABC',
      email: 'cliente@empresa.com',
      slug: 'empresa-abc',
      planPriceId: 'price-monthly',
      termsAccepted: true,
    })
    expect(capturedBody).not.toHaveProperty('amount')
    expect(capturedBody).not.toHaveProperty('stripePriceId')
    expect(capturedBody).not.toHaveProperty('tenantId')
  })
})

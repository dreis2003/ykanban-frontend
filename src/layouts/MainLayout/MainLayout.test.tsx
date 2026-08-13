import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout/MainLayout'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { authSession } from '@/shared/api/authSession'

describe('MainLayout', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    authSession.setAccessToken(null)
  })

  it('renderiza a marca YKanban no header e o conteúdo da rota filha', () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sem sessão restaurável')))

    const router = createMemoryRouter([
      {
        element: <MainLayout />,
        children: [{ path: '/', element: <p>conteúdo da página</p> }],
      },
    ])

    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    )

    expect(screen.getByRole('banner')).toHaveTextContent('YKanban')
    expect(screen.getByText('conteúdo da página')).toBeInTheDocument()
  })
})

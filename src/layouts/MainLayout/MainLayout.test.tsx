import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout/MainLayout'

describe('MainLayout', () => {
  it('renderiza a marca YKanban no header e o conteúdo da rota filha', () => {
    const router = createMemoryRouter([
      {
        element: <MainLayout />,
        children: [{ path: '/', element: <p>conteúdo da página</p> }],
      },
    ])

    render(<RouterProvider router={router} />)

    expect(screen.getByRole('banner')).toHaveTextContent('YKanban')
    expect(screen.getByText('conteúdo da página')).toBeInTheDocument()
  })
})

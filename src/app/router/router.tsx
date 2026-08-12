import { createBrowserRouter } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout/MainLayout'
import { HomePage } from '@/app/pages/HomePage/HomePage'
import { NotFoundPage } from '@/app/pages/NotFoundPage/NotFoundPage'
import { ROUTES } from '@/app/router/routes'

/**
 * Rotas públicas e autenticadas ainda não são diferenciadas nesta etapa — toda
 * a árvore hoje é pública. Quando a autenticação for implementada, um elemento
 * de guarda (ex.: RequireAuth) entra entre MainLayout e as rotas protegidas,
 * e autorização por role decorará rotas individuais a partir daí.
 */
export const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: [
      { path: ROUTES.home, element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

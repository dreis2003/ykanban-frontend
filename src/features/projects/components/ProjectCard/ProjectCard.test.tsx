import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ProjectCard } from '@/features/projects/components/ProjectCard/ProjectCard'
import type { Project } from '@/features/projects/types'

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    code: 'YK',
    name: 'YKanban',
    description: 'Gerenciamento de projetos',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-08-12T00:00:00Z',
    ...overrides,
  }
}

function renderCard(props: Partial<React.ComponentProps<typeof ProjectCard>> = {}) {
  const onEdit = vi.fn()
  const onArchive = vi.fn()
  const onActivate = vi.fn()
  render(
    <MemoryRouter>
      <ProjectCard
        project={makeProject()}
        canManage={true}
        onEdit={onEdit}
        onArchive={onArchive}
        onActivate={onActivate}
        {...props}
      />
    </MemoryRouter>,
  )
  return { onEdit, onArchive, onActivate }
}

describe('ProjectCard', () => {
  it('renderiza a estrutura esperada do card com título curto', () => {
    renderCard({ project: makeProject({ name: 'YKanban' }) })

    const card = screen.getByTestId('project-card')
    expect(card).toBeInTheDocument()
    expect(screen.getByText('YK')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'YKanban', level: 3 })).toBeInTheDocument()
    expect(screen.getByText(/Atualizado em/)).toBeInTheDocument()
  })

  it('renderiza título longo, com quebra de linha, sem quebrar a estrutura do card', () => {
    const longName =
      'Plataforma de Gerenciamento Integrado de Projetos e Fluxos de Trabalho da Yakuza Studio para Múltiplas Equipes'
    renderCard({ project: makeProject({ name: longName }) })

    const card = screen.getByTestId('project-card')
    const heading = screen.getByRole('heading', { level: 3 })
    expect(heading).toHaveTextContent(longName)
    // O card continua sendo um único container com a área de ações presente e ao final,
    // independentemente do título ocupar múltiplas linhas.
    expect(card).toContainElement(heading)
    expect(screen.getByTestId('project-card-actions')).toBeInTheDocument()
  })

  it('mantém a área de ações presente e ao final do card (mesmo pai), com botões clicáveis', async () => {
    const user = userEvent.setup()
    const { onEdit, onArchive } = renderCard({ project: makeProject({ status: 'ACTIVE' }) })

    const card = screen.getByTestId('project-card')
    const actions = screen.getByTestId('project-card-actions')
    expect(card).toContainElement(actions)
    // A área de ações deve ser o último filho direto do card, garantindo que fique ancorada ao rodapé.
    expect(card.lastElementChild).toBe(actions)

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    expect(onEdit).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Arquivar' }))
    expect(onArchive).toHaveBeenCalledTimes(1)
  })

  it('exibe "Reativar" para projetos arquivados', async () => {
    const user = userEvent.setup()
    const { onActivate } = renderCard({ project: makeProject({ status: 'ARCHIVED' }) })

    const reactivateButton = screen.getByRole('button', { name: 'Reativar' })
    await user.click(reactivateButton)
    expect(onActivate).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Arquivar' })).not.toBeInTheDocument()
  })

  it('não renderiza a área de ações quando o usuário não pode gerenciar projetos', () => {
    renderCard({ canManage: false })

    expect(screen.queryByTestId('project-card-actions')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
  })

  it('o rodapé de ações usa margin-top auto para se ancorar na base do card em qualquer altura de conteúdo', () => {
    renderCard()

    const actions = screen.getByTestId('project-card-actions')
    expect(getComputedStyle(actions).marginTop).toBe('auto')
  })
})

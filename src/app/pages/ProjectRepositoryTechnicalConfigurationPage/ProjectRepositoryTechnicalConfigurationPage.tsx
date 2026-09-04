import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { useAuth } from '@/features/auth/AuthContext'
import { projectsApi } from '@/features/projects/api/projectsApi'
import { repositoriesApi } from '@/features/repositories/api/repositoriesApi'
import { technicalConfigurationApi } from '@/features/technicalConfiguration/api/technicalConfigurationApi'
import { CommandListEditor } from '@/features/technicalConfiguration/components/CommandListEditor/CommandListEditor'
import {
  BUILD_TOOL_LABELS,
  BUILD_TOOL_OPTIONS,
  LANGUAGE_LABELS,
  LANGUAGE_OPTIONS,
  RUNTIME_LABELS,
  RUNTIME_OPTIONS,
  TECHNICAL_CONFIGURATION_PRESETS,
} from '@/features/technicalConfiguration/types'
import type {
  BuildTool,
  Language,
  RepositoryCommand,
  Runtime,
  SaveRepositoryTechnicalConfigurationRequest,
} from '@/features/technicalConfiguration/types'
import { ApiError } from '@/shared/api/apiError'
import { StatusBadge } from '@/shared/components/StatusBadge/StatusBadge'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './ProjectRepositoryTechnicalConfigurationPage.module.css'

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

function validateWorkingDirectory(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('/') || trimmed.startsWith('\\') || /^[A-Za-z]:/.test(trimmed)) {
    return 'Diretório de trabalho deve ser relativo (sem caminho absoluto).'
  }
  if (trimmed.startsWith('~')) return 'Diretório de trabalho não pode referenciar o home do usuário.'
  if (trimmed.split(/[/\\]/).includes('..')) return 'Diretório de trabalho não pode conter "..".'
  return null
}

interface FormValues {
  language: Language
  languageVersion: string
  runtime: Runtime
  runtimeVersion: string
  framework: string
  frameworkVersion: string
  buildTool: BuildTool
  workingDirectory: string
  commands: RepositoryCommand[]
}

const EMPTY_FORM: FormValues = {
  language: 'NONE',
  languageVersion: '',
  runtime: 'NONE',
  runtimeVersion: '',
  framework: '',
  frameworkVersion: '',
  buildTool: 'NONE',
  workingDirectory: '.',
  commands: [],
}

export function ProjectRepositoryTechnicalConfigurationPage() {
  const { projectId, repositoryId } = useParams<{ projectId: string; repositoryId: string }>()
  const { membershipRole } = useAuth()
  const canManage = membershipRole === 'ADMIN' || membershipRole === 'PROJECT_MANAGER'
  const queryClient = useQueryClient()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormValues>(EMPTY_FORM)
  const [initializedFromServer, setInitializedFromServer] = useState(false)
  const [workingDirectoryError, setWorkingDirectoryError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedSuccess, setSavedSuccess] = useState(false)

  const { data: project, isLoading: isProjectLoading } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsApi.get(projectId as string),
    enabled: Boolean(projectId),
  })

  const { data: repository, isLoading: isRepositoryLoading } = useQuery({
    queryKey: ['project-repositories', projectId, 'detail', repositoryId],
    queryFn: () => repositoriesApi.get(projectId as string, repositoryId as string),
    enabled: Boolean(projectId) && Boolean(repositoryId),
  })

  const {
    data: configuration,
    isLoading: isConfigurationLoading,
    isError: isConfigurationError,
  } = useQuery({
    queryKey: ['repository-technical-configuration', projectId, repositoryId],
    queryFn: () => technicalConfigurationApi.get(projectId as string, repositoryId as string),
    enabled: Boolean(projectId) && Boolean(repositoryId),
  })

  // Sincroniza o formulário com o servidor uma única vez, na primeira carga com dados (nunca em
  // toda mudança de referência de `configuration`, para não descartar edições em andamento do
  // usuário em um eventual refetch em segundo plano) — atualização de estado durante a renderização
  // condicionada a uma flag que só liga uma vez, padrão documentado para "ajustar estado a partir
  // de dados recebidos" sem precisar de um `useEffect` (react.dev/learn/you-might-not-need-an-effect).
  if (configuration?.configured && !initializedFromServer) {
    setInitializedFromServer(true)
    setForm({
      language: configuration.language ?? 'NONE',
      languageVersion: configuration.languageVersion ?? '',
      runtime: configuration.runtime ?? 'NONE',
      runtimeVersion: configuration.runtimeVersion ?? '',
      framework: configuration.framework ?? '',
      frameworkVersion: configuration.frameworkVersion ?? '',
      buildTool: configuration.buildTool ?? 'NONE',
      workingDirectory: configuration.workingDirectory ?? '.',
      commands: configuration.commands,
    })
    setShowForm(true)
  }

  const saveMutation = useMutation({
    mutationFn: (payload: SaveRepositoryTechnicalConfigurationRequest) =>
      technicalConfigurationApi.save(projectId as string, repositoryId as string, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(['repository-technical-configuration', projectId, repositoryId], data)
      setSaveError(null)
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 4000)
    },
    onError: (error: unknown) => setSaveError(errorMessageFrom(error)),
  })

  function openForm() {
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function applyPreset(index: number) {
    const preset = TECHNICAL_CONFIGURATION_PRESETS[index]
    if (!preset) return
    setForm({
      language: preset.language,
      languageVersion: preset.languageVersion ?? '',
      runtime: preset.runtime,
      runtimeVersion: preset.runtimeVersion ?? '',
      framework: preset.framework ?? '',
      frameworkVersion: preset.frameworkVersion ?? '',
      buildTool: preset.buildTool,
      workingDirectory: preset.workingDirectory ?? '.',
      commands: preset.commands,
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextWorkingDirectoryError = validateWorkingDirectory(form.workingDirectory)
    setWorkingDirectoryError(nextWorkingDirectoryError)
    if (nextWorkingDirectoryError) return

    saveMutation.mutate({
      language: form.language,
      runtime: form.runtime,
      buildTool: form.buildTool,
      ...(form.languageVersion.trim() ? { languageVersion: form.languageVersion.trim() } : {}),
      ...(form.runtimeVersion.trim() ? { runtimeVersion: form.runtimeVersion.trim() } : {}),
      ...(form.framework.trim() ? { framework: form.framework.trim() } : {}),
      ...(form.frameworkVersion.trim() ? { frameworkVersion: form.frameworkVersion.trim() } : {}),
      ...(form.workingDirectory.trim() ? { workingDirectory: form.workingDirectory.trim() } : {}),
      commands: form.commands
        .map((command) => ({ ...command, command: command.command.trim() }))
        .filter((command) => command.command.length > 0),
    })
  }

  if (isProjectLoading || isRepositoryLoading) {
    return <StatusMessage variant="loading" title="Carregando…" />
  }

  if (!project || !repository) {
    return <StatusMessage variant="error" title="Não foi possível carregar o repositório." />
  }

  const isArchived = project.status === 'ARCHIVED' || repository.status === 'ARCHIVED'
  const readOnly = !canManage || isArchived
  const configured = configuration?.configured === true

  return (
    <section className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Navegação">
        <Link to={ROUTES.projects}>Projetos</Link>
        <span aria-hidden="true">/</span>
        <Link to={ROUTES.projectDetail(project.id)}>{project.name}</Link>
        <span aria-hidden="true">/</span>
        <Link to={ROUTES.projectRepositories(project.id)}>Repositórios</Link>
        <span aria-hidden="true">/</span>
        <span className={styles.breadcrumbCurrent}>{repository.name}</span>
      </nav>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Configuração técnica</h1>
          <p className={styles.subtitle}>
            Como o repositório <strong>{repository.name}</strong> deve ser desenvolvido e validado.
          </p>
        </div>
        <StatusBadge status={repository.status} />
      </header>

      {project.status === 'ARCHIVED' ? (
        <p className={styles.archivedNotice} role="status">
          Este projeto está arquivado e está em modo somente leitura.
        </p>
      ) : null}
      {repository.status === 'ARCHIVED' && project.status !== 'ARCHIVED' ? (
        <p className={styles.archivedNotice} role="status">
          Este repositório está arquivado e é somente leitura.
        </p>
      ) : null}

      {isConfigurationLoading ? <StatusMessage variant="loading" title="Carregando configuração técnica…" /> : null}

      {isConfigurationError ? (
        <StatusMessage variant="error" title="Não foi possível carregar a configuração técnica." />
      ) : null}

      {!isConfigurationLoading && !isConfigurationError && !configured && !showForm ? (
        <StatusMessage
          variant="empty"
          title="Configuração técnica ainda não definida."
          action={
            canManage && !isArchived ? (
              <button type="button" className={styles.primaryButton} onClick={openForm}>
                Configurar
              </button>
            ) : undefined
          }
        />
      ) : null}

      {!isConfigurationLoading && !isConfigurationError && showForm ? (
        <form className={styles.form} onSubmit={handleSubmit}>
          {canManage && !isArchived ? (
            <div className={styles.presets}>
              <span className={styles.presetsLabel}>Presets:</span>
              {TECHNICAL_CONFIGURATION_PRESETS.map((preset, index) => (
                <button
                  type="button"
                  key={preset.label}
                  className={styles.presetButton}
                  onClick={() => applyPreset(index)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="tc-language">
                Linguagem
              </label>
              <select
                id="tc-language"
                className={styles.select}
                value={form.language}
                disabled={readOnly}
                onChange={(event) => setForm({ ...form, language: event.target.value as Language })}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {LANGUAGE_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="tc-language-version">
                Versão da linguagem
              </label>
              <input
                id="tc-language-version"
                className={styles.input}
                value={form.languageVersion}
                disabled={readOnly}
                placeholder="21"
                onChange={(event) => setForm({ ...form, languageVersion: event.target.value })}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="tc-runtime">
                Runtime
              </label>
              <select
                id="tc-runtime"
                className={styles.select}
                value={form.runtime}
                disabled={readOnly}
                onChange={(event) => setForm({ ...form, runtime: event.target.value as Runtime })}
              >
                {RUNTIME_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {RUNTIME_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="tc-runtime-version">
                Versão do runtime
              </label>
              <input
                id="tc-runtime-version"
                className={styles.input}
                value={form.runtimeVersion}
                disabled={readOnly}
                placeholder="21"
                onChange={(event) => setForm({ ...form, runtimeVersion: event.target.value })}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="tc-framework">
                Framework
              </label>
              <input
                id="tc-framework"
                className={styles.input}
                value={form.framework}
                disabled={readOnly}
                placeholder="Spring Boot"
                onChange={(event) => setForm({ ...form, framework: event.target.value })}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="tc-framework-version">
                Versão do framework
              </label>
              <input
                id="tc-framework-version"
                className={styles.input}
                value={form.frameworkVersion}
                disabled={readOnly}
                placeholder="3"
                onChange={(event) => setForm({ ...form, frameworkVersion: event.target.value })}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="tc-build-tool">
                Ferramenta de build / Package manager
              </label>
              <select
                id="tc-build-tool"
                className={styles.select}
                value={form.buildTool}
                disabled={readOnly}
                onChange={(event) => setForm({ ...form, buildTool: event.target.value as BuildTool })}
              >
                {BUILD_TOOL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {BUILD_TOOL_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="tc-working-directory">
                Diretório de trabalho
              </label>
              <input
                id="tc-working-directory"
                className={styles.input}
                value={form.workingDirectory}
                disabled={readOnly}
                placeholder="."
                onChange={(event) => setForm({ ...form, workingDirectory: event.target.value })}
              />
              {workingDirectoryError ? (
                <p className={styles.fieldError} role="alert">
                  {workingDirectoryError}
                </p>
              ) : null}
            </div>
          </div>

          <div className={styles.commandsSection}>
            <h2 className={styles.commandsTitle}>Comandos</h2>
            <CommandListEditor
              commands={form.commands}
              disabled={readOnly}
              onChange={(commands) => setForm({ ...form, commands })}
            />
          </div>

          {saveError ? (
            <p className={styles.formError} role="alert">
              {saveError}
            </p>
          ) : null}

          {savedSuccess ? (
            <p className={styles.formSuccess} role="status">
              Configuração técnica salva com sucesso.
            </p>
          ) : null}

          {!readOnly ? (
            <div className={styles.actions}>
              <button type="submit" className={styles.primaryButton} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          ) : null}
        </form>
      ) : null}
    </section>
  )
}

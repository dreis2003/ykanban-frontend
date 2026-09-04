export type Language =
  | 'JAVA'
  | 'KOTLIN'
  | 'TYPESCRIPT'
  | 'JAVASCRIPT'
  | 'DART'
  | 'PHP'
  | 'PYTHON'
  | 'GO'
  | 'RUST'
  | 'SQL'
  | 'YAML'
  | 'OTHER'
  | 'NONE'

export type Runtime = 'JVM' | 'NODE' | 'DART' | 'PHP' | 'PYTHON' | 'GO' | 'NATIVE' | 'NONE' | 'OTHER'

export type BuildTool =
  | 'MAVEN'
  | 'GRADLE'
  | 'PNPM'
  | 'NPM'
  | 'YARN'
  | 'BUN'
  | 'FLUTTER'
  | 'COMPOSER'
  | 'PIP'
  | 'POETRY'
  | 'GO'
  | 'CARGO'
  | 'MAKE'
  | 'NONE'
  | 'OTHER'

export type CommandKind = 'INSTALL' | 'LINT' | 'FORMAT_CHECK' | 'TYPE_CHECK' | 'TEST' | 'VERIFY' | 'BUILD'

export interface RepositoryCommand {
  kind: CommandKind
  command: string
  description: string | null
}

export interface RepositoryTechnicalConfiguration {
  configured: boolean
  repositoryId: string
  language: Language | null
  languageVersion: string | null
  runtime: Runtime | null
  runtimeVersion: string | null
  framework: string | null
  frameworkVersion: string | null
  buildTool: BuildTool | null
  workingDirectory: string | null
  commands: RepositoryCommand[]
  createdAt: string | null
  updatedAt: string | null
}

export interface SaveRepositoryTechnicalConfigurationRequest {
  language: Language
  languageVersion?: string
  runtime: Runtime
  runtimeVersion?: string
  framework?: string
  frameworkVersion?: string
  buildTool: BuildTool
  workingDirectory?: string
  commands: RepositoryCommand[]
}

export const LANGUAGE_LABELS: Record<Language, string> = {
  JAVA: 'Java',
  KOTLIN: 'Kotlin',
  TYPESCRIPT: 'TypeScript',
  JAVASCRIPT: 'JavaScript',
  DART: 'Dart',
  PHP: 'PHP',
  PYTHON: 'Python',
  GO: 'Go',
  RUST: 'Rust',
  SQL: 'SQL',
  YAML: 'YAML',
  OTHER: 'Outra',
  NONE: 'Nenhuma',
}

export const LANGUAGE_OPTIONS: Language[] = [
  'JAVA',
  'KOTLIN',
  'TYPESCRIPT',
  'JAVASCRIPT',
  'DART',
  'PHP',
  'PYTHON',
  'GO',
  'RUST',
  'SQL',
  'YAML',
  'OTHER',
  'NONE',
]

export const RUNTIME_LABELS: Record<Runtime, string> = {
  JVM: 'JVM',
  NODE: 'Node.js',
  DART: 'Dart',
  PHP: 'PHP',
  PYTHON: 'Python',
  GO: 'Go',
  NATIVE: 'Nativo',
  NONE: 'Nenhum',
  OTHER: 'Outro',
}

export const RUNTIME_OPTIONS: Runtime[] = ['JVM', 'NODE', 'DART', 'PHP', 'PYTHON', 'GO', 'NATIVE', 'NONE', 'OTHER']

export const BUILD_TOOL_LABELS: Record<BuildTool, string> = {
  MAVEN: 'Maven',
  GRADLE: 'Gradle',
  PNPM: 'pnpm',
  NPM: 'npm',
  YARN: 'Yarn',
  BUN: 'Bun',
  FLUTTER: 'Flutter',
  COMPOSER: 'Composer',
  PIP: 'pip',
  POETRY: 'Poetry',
  GO: 'Go',
  CARGO: 'Cargo',
  MAKE: 'Make',
  NONE: 'Nenhuma',
  OTHER: 'Outra',
}

export const BUILD_TOOL_OPTIONS: BuildTool[] = [
  'MAVEN',
  'GRADLE',
  'PNPM',
  'NPM',
  'YARN',
  'BUN',
  'FLUTTER',
  'COMPOSER',
  'PIP',
  'POETRY',
  'GO',
  'CARGO',
  'MAKE',
  'NONE',
  'OTHER',
]

export const COMMAND_KIND_LABELS: Record<CommandKind, string> = {
  INSTALL: 'Instalação',
  LINT: 'Lint',
  FORMAT_CHECK: 'Verificação de formatação',
  TYPE_CHECK: 'Verificação de tipos',
  TEST: 'Testes',
  VERIFY: 'Verificação completa',
  BUILD: 'Build',
}

export const COMMAND_KIND_OPTIONS: CommandKind[] = [
  'INSTALL',
  'LINT',
  'FORMAT_CHECK',
  'TYPE_CHECK',
  'TEST',
  'VERIFY',
  'BUILD',
]

export interface TechnicalConfigurationPreset {
  label: string
  language: Language
  languageVersion?: string
  runtime: Runtime
  runtimeVersion?: string
  framework?: string
  frameworkVersion?: string
  buildTool: BuildTool
  workingDirectory?: string
  commands: RepositoryCommand[]
}

/** Presets são só um atalho de preenchimento no frontend — nunca persistidos (não existe
 * `presetId` no domínio, ver ADR 0033). */
export const TECHNICAL_CONFIGURATION_PRESETS: TechnicalConfigurationPreset[] = [
  {
    label: 'Java + Spring Boot + Maven',
    language: 'JAVA',
    languageVersion: '21',
    runtime: 'JVM',
    runtimeVersion: '21',
    framework: 'Spring Boot',
    frameworkVersion: '3',
    buildTool: 'MAVEN',
    workingDirectory: '.',
    commands: [
      { kind: 'TEST', command: './mvnw test', description: null },
      { kind: 'VERIFY', command: './mvnw verify', description: null },
      { kind: 'BUILD', command: './mvnw package', description: null },
    ],
  },
  {
    label: 'React + TypeScript + pnpm',
    language: 'TYPESCRIPT',
    runtime: 'NODE',
    framework: 'React',
    buildTool: 'PNPM',
    workingDirectory: '.',
    commands: [
      { kind: 'INSTALL', command: 'pnpm install --frozen-lockfile', description: null },
      { kind: 'LINT', command: 'pnpm lint', description: null },
      { kind: 'TEST', command: 'pnpm test', description: null },
      { kind: 'BUILD', command: 'pnpm build', description: null },
    ],
  },
]

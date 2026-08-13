# YKanban — Frontend

Frontend do YKanban: React 19 + TypeScript + Vite, arquitetura orientada a features. Autenticação
(login/sessão), dashboard de projetos, Board com colunas e Cards já implementados; ver
`agent_docs/` na raiz do repositório para o roadmap completo.

## Requisitos

- Node 24 LTS
- npm (gerenciador de pacotes do projeto — não usar yarn/pnpm)
- Docker + Docker Compose, para rodar a stack completa (Postgres + backend + frontend)

## Instalação

```bash
npm install
```

## Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste se necessário:

| Variável | Descrição | Default |
|---|---|---|
| `VITE_API_BASE_URL` | URL base da API do backend (prefixo `/api/v1`) | `http://localhost:8080/api/v1` |

Todas as variáveis `VITE_*` são embutidas no bundle em build time e ficam visíveis no navegador —
nunca coloque segredos aqui. O access token JWT fica em memória (nunca em `localStorage`); o
refresh token vive em cookie `HttpOnly` controlado pelo backend — o frontend nunca o lê.

## Rodando localmente

Com o backend disponível em `http://localhost:8080` (via `docker compose up postgres backend` na
raiz do repositório, ou `./mvnw spring-boot:run` dentro de `backend/`):

```bash
npm run dev
```

Acesse `http://localhost:5173`. Sem sessão válida, redireciona para `/login`; após autenticar, o
destino é `/projects` (dashboard). Cada projeto tem uma página própria (`/projects/{id}`) com o
Board e seus Cards.

## Build de produção

```bash
npm run build
npm run preview   # serve o build localmente para conferência
```

## Testes

```bash
npm test          # roda uma vez (CI)
npm run test:watch
npm run coverage
```

Vitest + React Testing Library, ambiente jsdom.

## Lint e formatação

```bash
npm run lint
npx tsc --noEmit
npm run format:check   # ou `npm run format` para aplicar
```

## Docker

```bash
docker build -t ykanban-frontend .
```

Build multi-stage: Node 24 para o build, servido por `nginx-unprivileged` (não-root) com fallback
de SPA para as rotas do React Router. A variável `VITE_API_BASE_URL` é passada como build arg
(`--build-arg VITE_API_BASE_URL=...`), já que é embutida no bundle e não pode ser trocada em
runtime do container.

## Docker Compose (stack completa)

Na raiz do repositório:

```bash
docker compose up --build
```

Sobe PostgreSQL, backend e frontend juntos. O frontend fica em `http://localhost:5173` (porta
configurável via `FRONTEND_PORT` no `.env` da raiz).

## Estrutura

```
src/
  app/
    router/       rotas centralizadas (React Router)
    providers/     composição de providers globais (ErrorBoundary, router)
    config/         leitura de variáveis de ambiente
    pages/          telas de nível de aplicação (ainda não pertencem a uma feature)
  shared/
    api/            cliente HTTP, Problem Details, estado de sessão
    components/     componentes reutilizáveis (ErrorBoundary, StatusMessage, ConfirmDialog, StatusBadge)
    hooks/          hooks reutilizáveis (useDebouncedValue)
    types/           tipos compartilhados (PageResponse, ProblemDetails)
    utils/            utilitários compartilhados (formatDate)
  layouts/          casca visual reutilizável (MainLayout)
  features/
    auth/             AuthProvider/useAuth, RequireAuth (guard de rota), authApi
    projects/         tipos, projectsApi, ProjectCard, ProjectFormDialog, ProjectsSummary
    board/            tipos, boardApi, ProjectBoard, BoardColumn, EditColumnDialog
    card/             tipos, cardApi, labels PT-BR, KanbanCard, CardFormDialog, CardDetailDialog
  styles/           design tokens e estilos globais
```

Alias de import: `@/*` aponta para `src/*`.

## Decisões desta etapa

- Sem biblioteca de componentes ainda — nenhum componente interativo complexo existe hoje.
  Recomendação para quando surgir (dropdowns, modais do board): **Radix UI Primitives**
  (headless, acessível, sem visual próprio).
- Sem estado global (Redux/Zustand). **TanStack Query** adotado a partir da feature de projetos —
  benefício arquitetural real a partir daqui: lista paginada/filtrada/pesquisável mais quatro
  mutações (criar/editar/arquivar/ativar) que precisam invalidar essa lista de forma consistente.
- `fetch` nativo em vez de axios — cliente HTTP próprio e enxuto em `shared/api/httpClient.ts`.
- Ícones: `lucide-react` (leve, tree-shakeable).
- Autenticação: access token JWT em memória (`shared/api/authSession.ts`), refresh via cookie
  `HttpOnly` (`credentials: 'include'` em toda chamada). O `httpClient` renova a sessão sozinho em
  um 401 (deduplicando refreshes concorrentes) e, se o refresh falhar, limpa a sessão e deixa o
  `RequireAuth` redirecionar para `/login`.
- Modais (`ConfirmDialog`, `ProjectFormDialog`, `EditColumnDialog`, `CardFormDialog`,
  `CardDetailDialog`) usam `<dialog>` nativo — foco/ESC/backdrop de graça, sem lib. jsdom não
  implementa `showModal()`/`close()`; há um polyfill mínimo em `src/test/setup.ts` para os testes
  rodarem.
- UI oculta ações de gerenciamento (criar/editar/arquivar projeto e coluna, criar/editar Card) para
  roles sem permissão — a permissão de Card (`ADMIN`/`PROJECT_MANAGER`/`DEVELOPER`) é mais ampla
  que a de coluna (`ADMIN`/`PROJECT_MANAGER`), então são duas flags distintas no frontend. Em todo
  caso isso é só UX — a autorização real é sempre validada no backend.
- `PageResponse<T>` e `formatDate` vivem em `shared/` (usados por mais de uma feature) — evita
  import cruzado entre `features/*`.
- Cards do Board são carregados de uma vez (`size=200`) e agrupados por coluna no cliente —
  aceitável na escala atual; a paginação real já existe no backend (`GET .../cards`) para quando
  for necessária.

## Pendências / próxima etapa

- Movimentação de Card entre colunas / drag-and-drop e refinamento visual (Prompt 08).
- Autorização por role em nível de projeto (hoje é global — infraestrutura pronta via `AuthUser.role`).

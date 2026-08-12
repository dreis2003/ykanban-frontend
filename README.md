# YKanban — Frontend

Fundação técnica do frontend do YKanban: React 19 + TypeScript + Vite, arquitetura orientada a
features, sem regras de negócio ainda (ver `agent_docs/` na raiz do repositório para o roadmap).

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
nunca coloque segredos aqui. Não há autenticação/JWT nesta etapa.

## Rodando localmente

Com o backend disponível em `http://localhost:8080` (via `docker compose up postgres backend` na
raiz do repositório, ou `./mvnw spring-boot:run` dentro de `backend/`):

```bash
npm run dev
```

Acesse `http://localhost:5173`. O frontend inicia normalmente mesmo que o backend esteja
indisponível — a página inicial mostra o estado de conectividade e permite tentar novamente.

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
    api/            cliente HTTP, Problem Details, health check
    components/     componentes reutilizáveis (ErrorBoundary, StatusMessage)
    types/           tipos compartilhados
  layouts/          casca visual reutilizável (MainLayout)
  features/         features de domínio (vazio nesta etapa — auth, projects, kanban virão aqui)
  styles/           design tokens e estilos globais
```

Alias de import: `@/*` aponta para `src/*`.

## Decisões desta etapa

- Sem biblioteca de componentes ainda — nenhum componente interativo complexo existe hoje.
  Recomendação para quando surgir (dropdowns, modais do board): **Radix UI Primitives**
  (headless, acessível, sem visual próprio).
- Sem estado global (Redux/Zustand) e sem cliente de data-fetching com cache (TanStack Query) —
  uma única chamada de health-check não justifica.
- `fetch` nativo em vez de axios — cliente HTTP próprio e enxuto em `shared/api/httpClient.ts`.
- Ícones: `lucide-react` (leve, tree-shakeable).

## Pendências / próxima etapa

- Autenticação e usuários (login, JWT, rotas protegidas por role).
- Feature de projetos e board Kanban.

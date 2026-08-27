# Project Context

Frontend do YKanban (React 19 + TypeScript, Vite) — ver `../CLAUDE.md` (raiz do repositório `ykanban-backend`) para o contexto completo do produto, stack e convenções gerais. Este arquivo cobre apenas o que é específico deste repositório.

# Repositório

Este diretório (`ykanban/frontend/`) é um repositório Git **separado** (`ykanban-frontend`), aninhado dentro da árvore de trabalho do `ykanban-backend` — tem seu próprio `.git`, sua própria branch `main`/`origin`, seu próprio histórico. Não confundir com o repositório pai: `git status`/`git log` aqui refletem só este repo.

# Isolamento de Workspace entre Agentes

- Cada agente/fork deve executar comandos, builds, testes, commits e alterações de arquivo exclusivamente no repositório/worktree que lhe foi atribuído.
- Nunca executar npm, Maven, git ou scripts em outro repositório do workspace durante uma execução paralela — builds concorrentes contra o mesmo `node_modules`/`dist`/`target` corrompem os resultados um do outro e produzem falhas enganosas que parecem regressões reais.
- Antes de qualquer comando destrutivo ou de build, confirmar:
  ```
  pwd
  git rev-parse --show-toplevel
  ```
  `git rev-parse --show-toplevel` deve apontar para `.../ykanban/frontend` (nunca para a raiz `.../ykanban`, que é o repositório backend). Se uma investigação levantar suspeita de problema em outro repositório do workspace (ex.: `backend/`), reporte ao coordenador em vez de entrar nele e rodar comandos lá.

# Commands

```
npm install
npm run dev
npm run test
npm run lint && npx tsc --noEmit
npm run build
```

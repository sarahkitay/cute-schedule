# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
PROYOU is an ADHD-friendly personal daily planner (PWA) built with React 19 + Vite 7. All client data is stored in `localStorage` (no backend DB). Serverless API routes in `api/` handle AI coaching (OpenAI) and push notifications (Vercel KV + Web Push).

### Node version
The project requires **Node 20** (see `.nvmrc`). The environment uses nvm; `nvm use 20` is needed before running commands.

### Commands
Standard commands are in `package.json`:
- **Dev server**: `npm run dev` (Vite, default port 5173)
- **Lint**: `npm run lint` (ESLint 9, warnings only — 0 errors expected)
- **Build**: `npm run build` (Vite production build to `dist/`)
- **Preview**: `npm run preview` (serves the built `dist/`)

### Running the dev server
Use `npm run dev -- --host 0.0.0.0` to expose the server outside localhost (needed in Cloud VM). The frontend works fully without any API keys — schedule, tasks, finance, themes, notes, and routines all use `localStorage`.

### API routes (optional for frontend-only work)
The `api/` directory contains Vercel serverless functions. They require `vercel dev` (not plain Vite) and the `OPENAI_API_KEY` env var for the AI coach feature. For most frontend work, these are not needed.

### Gotchas
- ESLint produces ~51 warnings (unused vars, exhaustive-deps) but **0 errors**. This is the normal state of the codebase.
- The `@vercel/kv` package is deprecated (warning during `npm install`). This is expected and does not affect functionality.
- There are no automated tests in this codebase. Verification is done via lint + build + manual testing.

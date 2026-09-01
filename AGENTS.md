# AGENTS.md

## Cursor Cloud specific instructions

### Overview

PROYOU (package name `cute-schedule`) is an ADHD-friendly personal daily planner + AI coaching SPA. Stack: React 19 + Vite 7, Vercel serverless API routes (`api/`), Firebase Auth/Firestore, Upstash Redis, OpenAI.

### Node version

The project requires Node 20 (`.nvmrc`). Use `source ~/.nvm/nvm.sh && nvm use 20` before running any npm commands.

### Package manager

npm with `legacy-peer-deps=true` (configured in `.npmrc`).

### Running the app in development

- **Frontend only (Vite dev):** `npm run dev` — serves SPA on port 5173. The `/api` proxy forwards to port 3000.
- **API routes (Vercel dev):** `npx vercel dev` — runs serverless functions on port 3000.
- **Known dev-mode issue:** The Vite proxy for `/api` intercepts the ESM import of `api/lib/fcmRegistrationToken.js` (used by `src/notifications.js`) because the browser request path starts with `/api`. This causes a 500 when port 3000 is not running. Workaround: use `npm run build && npm run preview` (port 4173) if you only need to view/test the UI without API. In production builds, Vite bundles the import at build time so the proxy is never hit.
- **Full dev:** Run both `npm run dev` and `npx vercel dev` together to have API routes available (coach, push notifications, cron). Some secrets are required for the API routes to function (see `.env.example`).

### Lint / Test / Build

- **Lint:** `npm run lint` — ESLint 9. The repo has pre-existing lint errors (12 errors, 8 warnings as of initial commit). These are in the existing code.
- **Tests:** `npm run test:coach` — runs Node.js test runner on `api/lib/coachValidate.test.mjs` (11 unit tests).
- **Build:** `npm run build` — Vite production build to `dist/`.
- **Preview built app:** `npm run preview` — serves `dist/` on port 4173.

### Environment variables

See `.env.example` and `.env.local.example` for the full list. Core secrets needed for API functionality:
- `VITE_FIREBASE_*` — Firebase client config (required for auth/sync)
- `OPENAI_API_KEY` — AI coach
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — push subscriptions, rate limiting
- `VAPID_*` — Web Push notifications

The app works for basic task management without any env vars (uses localStorage fallback).

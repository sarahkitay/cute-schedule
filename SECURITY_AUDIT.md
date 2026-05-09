# Security audit — cute-schedule (PROYOU)

**Audit type:** Defensive code and configuration review (no exploitation, no production data access).  
**Date:** 2026-05-02  
**Stack:** Vite + React (SPA), Firebase Auth + Firestore, Vercel serverless (`api/*.js`), Vercel KV, Capacitor iOS, Web Push (`web-push`).

---

## A. Executive summary

### Overall risk rating: **High** (for a production deployment with current API posture)

This repository is a **single-user personal schedule / coach app**. There are **no** staff portals, trainer roles, Stripe, Supabase, Twilio, Resend, or OAuth server callbacks in code. Primary risks are **unauthenticated abuse of serverless APIs** (cost / availability), **public push infrastructure** (KV pollution, reminder spam to endpoints that attacker can register), and **information disclosure** from error payloads (partially addressed in this pass).

### Top 5 most urgent risks

1. **`/api/coach` has no authentication** (Step 3) — Anyone who can reach the deployment can POST and consume **OPENAI_API_KEY** quota. **Rate limiting:** `/api/coach` now enforces **10 POSTs per minute per client IP** (fixed window) via **Vercel KV** (`api/lib/coachRateLimit.js`). Tune with `COACH_RATE_LIMIT_MAX` / `COACH_RATE_LIMIT_WINDOW_SEC`. If KV is unavailable, requests are allowed (same as push routes) so local dev without KV still works; production should keep KV linked for limiter + push.
2. **`/api/push/subscribe`, `/api/push/reminders`, `/api/push/register-native`** — No auth; **global KV namespaces** (`push:subs`, `push:native-subs`, per-subscription keys). Risk: storage abuse, registering junk endpoints/tokens, associating reminders with keys derived only from subscription endpoint knowledge.
3. **Cron endpoint `/api/cron/push`** — Without **`CRON_SECRET`** set in Vercel, the route is callable by **any client** (GET/POST) and triggers iteration over all web subscriptions (DoS / timing abuse). With **`CRON_SECRET`** set, Vercel sends `Authorization: Bearer <CRON_SECRET>` on cron invocations; the handler now enforces this when the env var is present.
4. **`/api/push/send` previously broadcast to every subscriber** — Fixed: server now sends **only** to the **PushSubscription** provided in the request body (same device that enabled push). Eliminates unauthenticated “notify everyone” abuse.
5. **Committed Vercel deploy hook URL in `package.json`** — Removed; treat the previously committed hook as **compromised**: revoke that deploy hook in Vercel and create a new one; use **`VERCEL_DEPLOY_HOOK_URL`** in the shell when running `npm run trigger-deploy`.

### What is currently safe

- **Firestore rules** (`firestore.rules`): Only `schedules/{docId}` with `request.auth.uid == docId`; default deny elsewhere. Strong **owner-scoped** model when clients use Firebase Auth (the app uses **anonymous auth** so guests get a real uid).
- **No `VITE_*` exposure** of `OPENAI_API_KEY`, `VAPID_PRIVATE_KEY`, or deploy secrets in audited source paths.
- **No Stripe / payment / webhooks** in this codebase.
- **No Supabase / Twilio / Resend** integrations in code.
- **Client Firebase config** (`VITE_FIREBASE_*`, `GoogleService-Info.plist`) is **expected** to be recoverable from apps; security relies on **rules + Auth**, not hiding the web API key.

### Immediate action before broad production use

1. Set **`CRON_SECRET`** in Vercel (Production + Preview if crons run there) and redeploy so `/api/cron/push` is not public.
2. Add **server-side auth** (Firebase Admin verifyIdToken) to **`/api/coach`** and rate limiting (KV, Upstash, or Vercel firewall).
3. **Rotate** the old **deploy hook** that was embedded in `package.json` (if it was ever deployed from this repo).
4. Restrict **Google Cloud API key** used by Firebase (HTTP referrers / app restrictions) and enable **Firebase App Check** for Firestore if abuse appears.
5. Optionally set **`API_ALLOWED_ORIGINS`** to a comma-separated list of production (and Capacitor `https://localhost` if needed) origins instead of wildcard CORS on API routes.

---

## B. Route attack matrix

| Path | Public | Role | Data exposed / effect | Protection | Attacker test | Finding | Severity |
|------|--------|------|------------------------|-------------|---------------|---------|----------|
| `GET /api/push/vapid` | Yes | None | VAPID **public** key | GET only | `curl` URL | Public key is intentional for Web Push subscribe | **Low** |
| `POST /api/push/subscribe` | Yes | None | Writes subscription to KV | None | POST fake subscription JSON | Unauthenticated KV write / pollution | **High** |
| `POST /api/push/reminders` | Yes | None | Writes reminder list keyed by subscription endpoint | None | POST with known/guessed subscription | Reminder spam for that subscription key | **High** |
| `POST /api/push/register-native` | Yes | None | Native device token in KV | Token length check only | POST many tokens | KV fill / cost | **Medium–High** |
| `POST /api/push/send` | Was Yes | None | **Was:** push to **all** subs | **Now:** requires `subscription` in body; sends to that sub only | POST without subscription → 400 | Broadcast abuse **mitigated** | Was **Critical** → **Lower** (targeted abuse only) |
| `GET/POST /api/cron/push` | Yes if no `CRON_SECRET` | Cron | Sends due reminders to all web subs in KV | VAPID + KV; optional Bearer `CRON_SECRET` | Hit URL repeatedly | Load / annoy subscribers | **High** without secret |
| `POST /api/coach` | Yes | None | Proxies user JSON to OpenAI; returns model JSON | `OPENAI_API_KEY` server-side; **10/min/IP** via KV; CORS configurable | Flood POST from many IPs / no KV | Key burn, cost | **High** (abuse); **Medium** with KV + RL |
| SPA routes (`/`, etc.) | Yes | Firebase for sync | User’s own schedule in UI | Firestore rules | N/A for other users’ data | No multi-tenant staff routes | **Low** (rules) |
| Stripe webhooks | N/A | — | — | — | — | **Not present** | — |
| Supabase | N/A | — | — | — | — | **Not present** | — |

**Exact fix (coach):** Verify `Authorization: Bearer <Firebase ID token>` with Firebase Admin SDK; reject missing/invalid token; optionally cap body size and fields.

**Exact fix (push KV):** Tie subscriptions to authenticated uid (second KV key namespace per user) or signed opaque token issued after login.

**Exact fix (cron):** Set `CRON_SECRET` in Vercel; handler already requires `Authorization: Bearer ${CRON_SECRET}` when set.

---

## C. Secret exposure audit

| Variable / asset | Where | Frontend safe? | Notes |
|------------------|-------|------------------|-------|
| `VITE_FIREBASE_*` | `src/firebase.js` | Public embed | Normal; restrict with GCP key restrictions + App Check. |
| `VITE_APP_ORIGIN` | `src/apiBase.js` | Public | URL only; not a secret. |
| `VITE_APPLE_*` | `src/firebase.js` | Public identifiers | Not Apple private keys. |
| `OPENAI_API_KEY` | `api/coach.js` | **Server only** | Correct; never `VITE_`. |
| `VAPID_PUBLIC_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `api/lib/vapidEnv.js`, `GET /api/push/vapid` | Public key | OK. |
| `VAPID_PRIVATE_KEY` | `api/push/send.js`, cron, `webpush` | **Server only** | OK. |
| `CRON_SECRET` | `api/cron/push.js` | **Server only** | Set in Vercel when locking cron. |
| `API_ALLOWED_ORIGINS` | `api/lib/cors.js` | **Server only** | Optional hardening. |
| `GoogleService-Info.plist` | `ios/App/App/` | In app bundle | Contains Firebase iOS client identifiers; restrict API key in Google Cloud. |
| GitHub `VERCEL_TOKEN` / org / project | `.github/workflows/deploy-vercel.yml` | CI secrets | OK as secrets; not in tree. |
| **Removed** deploy hook in `package.json` | Was committed | **Leaked capability** | **Rotate** hook in Vercel. |

**Client-side logging:** `src/notifications.js` previously logged full APNs token in dev path — changed to avoid logging raw token in production builds.

---

## D. Auth and role audit

| Area | Finding |
|------|---------|
| Staff / admin / trainer routes | **None** in app — single-user product. |
| Firestore | **Server-side rules** enforce `schedules/{uid}` owner match. |
| Serverless APIs | **No** Firebase token verification on `/api/coach` or push endpoints. |
| React / SPA | UI hiding is **not** authorization; all enforcement must stay on server/Firestore. |
| Privilege escalation | N/A for roles; risk is **cross-tenant** N/A and **API abuse**. |

**Fix plan:** Introduce Firebase Admin in Vercel, verify ID token on coach + optionally push writes, map KV keys with `uid:` prefix.

---

## E. Database rules audit

**Collection:** `schedules/{docId}`

```4:11:firestore.rules
service cloud.firestore {
  match /databases/{database}/documents {
    match /schedules/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == docId;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

| Check | Status |
|-------|--------|
| Owner uid | **Yes** — `docId` must equal `request.auth.uid`. |
| Overly broad | **No** — catch-all denies. |
| Client trusts IDs | App uses `getScheduleDocId()` from Auth uid (anonymous ok). |

**Unsafe reads/writes:** None in Firestore for other users **if** rules are deployed as in repo. **Verify** Firebase Console rules match `firestore.rules`.

---

## F. Webhook audit

| Integration | Present? | Signature / validation | Notes |
|-------------|----------|-------------------------|-------|
| Stripe | No | — | — |
| Twilio | No | — | — |
| Resend | No | — | — |
| Google OAuth | Client Firebase OAuth only | Firebase handles token exchange | No custom callback route in `api/`. |
| Vercel Cron → `/api/cron/push` | Yes | **`CRON_SECRET`** Bearer when env set | Not a third-party webhook; secure with env. |

---

## G. Remediation plan

1. **Emergency (today):** Rotate leaked **deploy hook**; set **`CRON_SECRET`** in Vercel; confirm Firestore rules deployed.  
2. **High (this week):** Add **Firebase ID token** verification to `/api/coach`; rate limit coach; consider auth or signed nonces for push KV writes.  
3. **Hardening:** `API_ALLOWED_ORIGINS`; request body size limits; App Check; remove any remaining verbose client errors.  
4. **Polish:** Structured logging without PII; dependency automation; security headers via Vercel config.

---

## H. Patch plan (issues addressed in repo vs manual)

| Issue | File | Change | Verify |
|-------|------|--------|--------|
| Broadcast push abuse | `api/push/send.js` | Require `subscription` in POST body; send only to that sub | Enable push → Send test → only this device |
| Cron public invocation | `api/cron/push.js` | If `CRON_SECRET` set, require `Authorization: Bearer …` | With secret: curl without header → 401; Vercel cron → 200 |
| Error disclosure (coach) | `api/coach.js` | Production responses omit raw model output / stack strings | `NODE_ENV=production` deploy, force OpenAI error → generic JSON |
| Wildcard CORS (optional tighten) | `api/lib/cors.js` + consumers | `API_ALLOWED_ORIGINS` comma list or `*` | Set env, test from allowed browser origin |
| Leaked deploy hook | `package.json` | `trigger-deploy` uses `VERCEL_DEPLOY_HOOK_URL` | Unset → script exits 1 with message |
| APNs token in logs | `src/notifications.js` | No full token log in prod build | Inspect device log |
| Test push client | `src/app.jsx`, `src/notifications.js` | Pass subscription JSON to `/api/push/send` | Send test after enable |

**Not changed (requires your dashboard / secrets):** Firestore rules file unchanged; no Firebase Admin wiring; no payment logic; no secret rotation performed in repo.

---

## Manual steps (Vercel / Firebase / Google)

1. **Vercel:** Project → Settings → Environment Variables — add **`CRON_SECRET`** (random 32+ chars); redeploy. Confirm cron still succeeds (check function logs).  
2. **Vercel:** Revoke old **Deploy Hook** from leaked `package.json`; create new hook; export **`VERCEL_DEPLOY_HOOK_URL`** locally when using `npm run trigger-deploy`.  
3. **Vercel (optional):** **`API_ALLOWED_ORIGINS`**=`https://yourapp.vercel.app,https://localhost` (adjust for Capacitor / custom domain).  
4. **Firebase Console:** Deploy **`firestore.rules`**; enable **Anonymous**, **Google**, **Email** as intended.  
5. **Google Cloud Console:** API key used by Firebase — add **Application restrictions** (HTTP referrers for web; iOS bundle for app).  
6. **Firebase App Check (optional):** Enable for Firestore if automated abuse appears.

---

## Production secrets to rotate

- **Vercel deploy hook** that appeared in `package.json` (if ever valid in production).  
- **Optional:** `OPENAI_API_KEY` if you believe `/api/coach` was heavily abused before auth is added.

---

## Dependency & build notes

- Run **`npm audit`**, **`npm run lint`**, **`npx tsc --noEmit`** (see audit report in agent output).  
- **No `npm test` script** in `package.json`.  
- **`npm audit`** may exit non-zero while transitive advisories exist (e.g. Vite, picomatch); review `npm audit fix` in a branch after reading changelogs—dev-server CVEs often do not affect production static hosting.

---

## CORS / indexing / deployment

- **CORS:** Push + coach routes use **`applyApiCors`**; default remains `*` unless `API_ALLOWED_ORIGINS` is set.  
- **robots / noindex:** Not configured; SPA is indexable like any public site — add if you need privacy.  
- **Preview deployments:** Same API routes as production unless env differs — treat Preview secrets and hooks carefully.

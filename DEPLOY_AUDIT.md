# Deployment audit: GitHub → Vercel not triggering

**Date:** 2026-02-22  
**Repo:** `sarahkitay/cute-schedule`  
**Branch:** `main` (tracks `origin/main`)

---

## 1. Repo status (OK)

| Check | Result |
|-------|--------|
| Remote | `origin` → `git@github.com:sarahkitay/cute-schedule.git` |
| Branch | `main` tracking `origin/main` |
| Local build | `npm run build` succeeds |
| vercel.json | Valid (rewrites + crons, no bad config) |
| .github/workflows | None (no Actions; Vercel uses GitHub App webhook) |

So the codebase and Git setup are fine. The issue is almost always **Vercel ↔ GitHub connection or permissions**.

---

## 2. Why pushes might not trigger Vercel

From [Vercel KB](https://vercel.com/kb/guide/why-aren-t-commits-triggering-deployments-on-vercel):

1. **Git integration / permissions**
   - Vercel is disconnected from the repo, or connected to the wrong repo/branch.
   - The **Vercel for GitHub** app doesn’t have access to `sarahkitay/cute-schedule` (not installed on the org/repo, or repo not in the allowed list).
   - For **private** repos: Team plan may require Pro; Hobby can deploy if the repo is allowed and you’re the owner.

2. **Commit author vs Vercel account**
   - The **Git author** (email/name on the commit) must match a user linked to the Vercel project (e.g. you’re the one who pushed and your GitHub is linked to Vercel).
   - If you see “Git author must have access to project” in Vercel or on the GitHub commit, fix this.

3. **Production branch**
   - In Vercel, **Production Branch** must be the one you push to (e.g. `main`). If it’s set to something else, pushes to `main` won’t create Production deploys.

4. **Ignored Build Step**
   - If “Ignored Build Step” is set to a custom command that exits non‑zero, Vercel will skip building. Set it to **Automatic** (or leave default) so every push to the production branch builds.

5. **Webhook / events**
   - GitHub must be able to send push events to Vercel. If the integration was disconnected and reconnected, sometimes removing and re-adding the repo in Vercel fixes it.

---

## 3. Fix checklist (do these in order)

### On Vercel

1. Go to [vercel.com](https://vercel.com) → your **cute-schedule** project.
2. **Settings → Git**
   - **Connected Git Repository:** should be `sarahkitay/cute-schedule` (or `sarahkitay/cute-schedule` with correct spelling). If it says “No repository connected”, connect it and choose this repo.
   - **Production Branch:** set to `main` (same branch you push to).
3. **Settings → Git → Deploy Hooks** (optional)
   - You already have a deploy hook; you can trigger deploys manually with `npm run trigger-deploy` if auto-deploy is still broken.
4. **Settings → General**
   - **Ignored Build Step:** set to **Automatic** (or clear any custom “ignore” command).
5. Open **Deployments** and check the latest deployment:
   - If there is no new deployment when you push, the webhook isn’t firing (see GitHub steps below).
   - If a deployment appears but is **Failed**, open it and use the **Build Logs** to fix the error (often env vars or Node version).

### On GitHub

1. Go to [github.com/sarahkitay/cute-schedule](https://github.com/sarahkitay/cute-schedule) → **Settings** (repo settings) → **Integrations** or **Webhooks**.
2. **Integrations**
   - Find **Vercel** in the list. Ensure the Vercel app has access to this repository (e.g. “All repositories” or `cute-schedule` selected).
3. **Webhooks**
   - You should see a webhook for Vercel (e.g. `https://api.vercel.com/...`). If it’s missing, reconnecting the repo in Vercel usually recreates it. Check “Recent Deliveries” for failed requests (e.g. 4xx/5xx).

### Reconnect (if needed)

1. Vercel → Project **Settings → Git**.
2. **Disconnect** the repository, then **Connect** again and select `sarahkitay/cute-schedule`.
3. Ensure **Production Branch** is `main`, then push a new commit to `main` and see if a deployment starts.

---

## 4. npm audit

- Ran `npm audit fix` (no `--force`). Some issues were fixed; **7 remain** (in `web-push` and `eslint` / `minimatch`).
- Remaining fixes would require `npm audit fix --force` (breaking changes). They are in **dev** / optional deps and do **not** block `npm run build` or Vercel builds.
- You can run `npm audit fix --force` later if you want to chase them; not required for deployments.

---

## 5. Backup: deploy without GitHub

If you need a deploy before the GitHub → Vercel link is fixed:

```bash
npm run trigger-deploy
```

This calls your Vercel Deploy Hook and starts a deployment from the current Git state (Vercel will pull from the connected repo when the hook runs).

---

## Summary

- **Repo and build:** OK.  
- **Likely cause:** Vercel not receiving push events (integration/permissions) or Production Branch / Ignored Build Step.  
- **Do:** Recheck Vercel **Git** and **Production Branch**, and GitHub **Integrations** / **Webhooks**; reconnect the repo if needed; set Ignored Build Step to Automatic.  
- **Optional:** Use `npm run trigger-deploy` to deploy on demand.

# SANDBOX — differences from production

This repo (`frontier-design/shen-foundation-web-sandbox`) is a private mirror of `frontier-design/shen-foundation-web`. It's used to test the self-hosted CMS ("Frontier CMS Dev" app, staging CMS) without touching production.

**Nothing listed here is ever copied back to `shen-foundation-web`.** Changes flow one way only: production → sandbox.

## Bringing production changes in
```sh
git remote add production https://github.com/frontier-design/shen-foundation-web.git   # once
git fetch production
git switch preview && git merge production/preview
```
On conflicts in the files below, keep the sandbox side. Never push the sandbox to the `production` remote, and never open pull requests from here to production.

## Committed differences (sandbox-only commits)

| File | Difference | Why |
|---|---|---|
| `SANDBOX.md` | This file | — |
| `.pages.yml` | The 7 video-field `pattern.regex` values also accept the sandbox store host `adcq3xook5cajgm3.public.blob.vercel-storage.com`, alongside the production host. Fields: `home` → `callout.imageVideo`; `aboutPage` → `heroVideo`; `aboutPage` → `people[].photoVideo`; `artists` → `thumbnailVideo`; `exhibitions` → `heroVideo`; `exhibitions` → gallery block `video` → `video` (no `^$\|` empty option there); `events` → `imageVideo`. | Pages CMS reads `.pages.yml` as is and can't use environment variables. Production keeps only its own host. |
| `README.md` | Preview and live URLs point to the sandbox project | Documentation only |
| `api/cron/cleanup-videos.js` | `DRY_RUN = true` (only a difference once production switches to `false`) | Never delete in the sandbox |
| `content/**`, `public/media/**` | Test edits made through the staging CMS | Test data |

Everything else (workflows, `api/`, `src/`, `scripts/`) is identical to production. Repo, token address and Blob host come from settings (see below), with production values as defaults.

## Settings differences (not in git)

**Vercel project `shen-foundation-web-sandbox`** (Settings → Environment Variables; "Enable access to System Environment Variables" on):

| Variable | Sandbox value | Production equivalent |
|---|---|---|
| `SITE_REPO` | `frontier-design/shen-foundation-web-sandbox` | not set (detected / default) |
| `VITE_BLOB_HOST` | `adcq3xook5cajgm3.public.blob.vercel-storage.com` | not set (default: production host) |
| `BLOB_READ_WRITE_TOKEN` | from connecting `shen-foundation-videos-sandbox` | `shen-foundation-videos` |
| `VIDEO_JOB_SECRET` | own value (same as the sandbox repo secret) | production value |
| `CRON_SECRET` | own value | production value |
| `GITHUB_CONTENT_TOKEN` | fine-grained PAT, **sandbox repo only**, Contents: Read | production PAT |
| Deployment Protection bypass secret ("CMS preview links") | own secret, used by the staging CMS | production secret, used by the production CMS |

**GitHub repo `shen-foundation-web-sandbox`** (Settings → Secrets and variables → Actions):

| Name | Kind | Sandbox value |
|---|---|---|
| `VIDEO_JOB_SECRET` | Secret | own value |
| `VIDEO_TOKEN_URL` | Variable | `https://shen-foundation-web-sandbox.vercel.app/api/video/token` |

**Connected services:**
- Blob store `shen-foundation-videos-sandbox` (yul1).
- GitHub App "Frontier CMS Dev" (staging CMS) is installed here. The production "Shen Foundation CMS" app is **not**.

## Never in the sandbox
- Production secrets, tokens or PATs.
- The production Blob store or its token.
- The production database.
- The production GitHub App.

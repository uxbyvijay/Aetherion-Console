# Aetherion Console: developer handover

Aetherion Console (formerly Synx Brain) is the CMS for four websites: Morph Space, Synx Tools, Real Time Web and Skalle.
This page is what a new developer needs to run it, and what is still open.

## What is in the repo (`cms/`)

| App | What | Port |
| --- | --- | --- |
| `apps/api` | Fastify + Prisma + Postgres API | 4000 |
| `apps/admin` | React 19 + Vite admin | 5173 |
| `apps/morph-space`, `synx-tools`, `skalle`, `rtw` | Site previews that read the CMS | 5180 to 5183 |

The real site repositories live outside this repo (`Synx`, `therealwebpoc`, `morph-space`, `skalleaiLP`). The CMS reaches them only through GitHub pull requests.

## Run it

```bash
cd cms
npm install
docker compose up -d                 # Postgres on 127.0.0.1:5433 (user, password and database: cms)
cp apps/api/.env.example apps/api/.env
npm run deploy -w apps/api           # apply migrations
npm run dev                          # api, admin and the four site previews
```

Minimum `apps/api/.env`: `DATABASE_URL` (`postgresql://cms:cms@localhost:5433/cms`) and a `JWT_SECRET` of 16 or more characters. Everything else is optional and documented in `.env.example`.

The first account created through the sign-up screen becomes super admin. After that only a super admin can add people (Settings, User management).

Windows: stop the API before `prisma generate`, or it fails with EPERM.

## Data is not in git

Sites, content types, entries and media live in your local Postgres and `UPLOAD_DIR`. A fresh database is empty. To get content:

```bash
npm run seed:skalle -w apps/api
npm run seed:rtw -w apps/api
```

Morph Space and Synx Tools content has no seed script yet: ask for a database dump, or export from the console that has it.

## Secrets

- Never commit `apps/api/.env` (it is gitignored). Share secrets through a password manager.
- Stored AI keys and connector tokens are encrypted with `CONNECTOR_KEY`, or `JWT_SECRET` when that is unset. Another developer cannot read them unless they use the same value; they can simply add their own keys.
- Use your own `JWT_SECRET`, your own AI key, and for GitHub either a fine-grained token (`GITHUB_TOKEN`: contents and pull requests, no merge) or your own GitHub App. You do not need the production App private key.
- `GITHUB_ALLOWED_OWNERS` limits which owners can be linked.

## Publishing through GitHub

Described in [github-publishing.md](github-publishing.md). In short: Settings, Websites, a site, GitHub. Review the changes, press Final Push, and a pull request opens in the linked repository. The console never merges. Only files under `<content folder>/aetherion/` are ever written, and package, lock, build, `.env` and workflow files are refused.

One open pull request per website at a time: merge or close it on GitHub before pushing again.

## Keeping the site previews in step with the repositories

The previews in `apps/` are copies of the four Synx-Tools repositories, adapted to read their content from the CMS. `npm run sync:sites` brings other developers' changes into them: it fetches the repositories from GitHub (nothing to pull by hand, your own clones are not touched), three-way merges the changes since the last sync into each preview file, copies new pictures and videos, and lists anything it cannot merge safely under REVIEW. Add `-- --apply` to write the changes, `-- --site rtw` for one site. It runs by itself with `--apply` every time you start `npm run dev`. The last synced commit is kept in `apps/<site>/.repo-sync.json`. A file listed under REVIEW (for example a Next.js page the preview builds from CMS content) has to be ported by a person; the marker does not move until that is done.

## Tests

There is no automated test suite yet. What has been checked by hand and by script: type checks for all six apps (`npx tsc --noEmit -p .` in each), an API run covering sign-in, roles, sites, types, entries, public API, media and the GitHub routes, and a click-through of the admin. Adding these as a real suite (for example Vitest on the API) is a good first task.

## Known gaps

- Sites do not read `content/aetherion/*.json` yet, so a merged pull request stores content in the repo but changes nothing live.
- Branch protection on `main` (pull request and at least one approval) must be switched on in each site repository. The console never calls merge, but the repository is what enforces it.
- Lint, type check and build are not run by the console (the pull request only adds JSON). Repository CI should run on pull requests.
- Not tried against the real services: Google sign-in, the reset-code email in a real inbox, LinkedIn posting, ChatGPT over MCP (needs a public HTTPS address).
- RTW contact form has no backend, and Skalle has no print/PDF route.
- Internal ids still say `synx-brain`. Do not change the encryption salt `synx-brain-connectors:`: it would make stored keys unreadable.
- Editors can manage AI keys, including one that other sites share. Say if that should be admin only.

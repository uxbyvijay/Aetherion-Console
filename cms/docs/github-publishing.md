# Publishing through GitHub (Aetherion Console)

Admin edits content in the console, reviews what changed, and presses **Final Push**. The console opens a pull request.
A person reviews and merges it on GitHub, and the repository's own deployment publishes it. The console never merges.

## How it works

1. **Connect** (Settings, Websites, a site, GitHub). One site is linked to one repository, a base branch and a content folder.
   Sign-in is a GitHub App installed on the organisation (`GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY`
   or `GITHUB_APP_PRIVATE_KEY_PATH`), or a fine-grained `GITHUB_TOKEN`. `GITHUB_ALLOWED_OWNERS` limits which owners can be linked.
   The credentials stay on the server: no route returns them.
2. **Track changes.** Content lives in the database. The console writes the published entries as JSON files in one folder,
   `<content folder>/aetherion/<type>/<entry>.json` plus `_schema.json`, and compares them with the base branch.
   Every difference is a change: added, changed or removed file, with the original and new text. Drafts are never exported.
3. **Review.** The admin sees the file list, can open before and after for each file, and picks the files to send.
   Removed files are off by default.
4. **Final Push** (admin confirms repository and base branch). The server recomputes everything from the database and the
   repository (the browser cannot add files or text), validates, then creates a branch `aetherion/<site>-<date>-<id>` from the base
   branch, makes one commit and opens a pull request that lists the files and the purpose.
5. **Status.** The pull request state (pending review, approved, changes requested, merged, closed) is read live from GitHub.
6. **Audit.** Connect, disconnect, blocked pushes and opened pull requests are written to the audit log (Recent activity).

## Safety rules (enforced in code)

- Writes only inside `<content folder>/aetherion/`. Anything else, or a path with `..` or `.git`, is rejected.
- Package manifests, lockfiles, build configs, Dockerfiles, `.env`, workflows and key files are never written. A change
  that needs one must be made by a person directly in the repository.
- Secret scan (private keys, GitHub, Groq/OpenAI, AWS, Slack tokens, MCP/CMS keys, password assignments), JSON validity, size limits.
  Any failure blocks the push and shows the exact reason; nothing is created.
- There is no merge call anywhere in the code. The GitHub App has contents and pull-request write only, no admin.
- Lint, type check and build are not run by the console: the pull request contains data files only, so the repository's own CI
  runs on the pull request.
- Not a worktree: changes are prepared through GitHub's API on a new branch, and the console's own working copy is never touched.

## Still to do on GitHub (not something the console can do)

- Turn on **branch protection on `main`** in each repository with required reviews. This is what truly stops an unreviewed merge.
- The sites must read the exported files (or a build step must) before the exported content has any effect on the live site.
  Until then a merged pull request only stores the content in the repository.

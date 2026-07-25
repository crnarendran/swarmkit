---
type: reference
tags: [infrastructure, deployment, reference, docs-portal]
status: filled
---
# Infrastructure Map

This project has no infrastructure of its own — no hosting, no database,
no compiled backend. The only real infrastructure it touches is a
**write-only integration into a sibling project's docs portal**, described
below. The `Docs` agent owns keeping this current (see its `agent.json`);
every other role should read it before touching `.github/workflows/sync-docs.yml`
or `scripts/syncDocs.ts`.

## Why this file exists

A real swarm session on a sibling project spent a large amount of a
session's budget re-discovering infrastructure state that had never been
written down: which cloud project was which, why a GitHub secret's name
didn't match the project it actually authenticated against, which
environments had which services enabled, and which CI service account was
missing which IAM role. None of that was hard to find — it just had never
been recorded anywhere an agent could read it first. Don't repeat that.

## Environments

This repo doesn't have its own environments — it has no hosting or
database of its own. It publishes its own docs (`README.md`, `AGENTS.md`,
`docs/`, `knowledge/`, `.agents/skills/*/SKILL.md`) into a sibling
project's (`sanjeev-ai`) shared docs-portal Firestore, tagged
`project: 'swarmkit'`.

| Environment | Where it lives | Purpose |
|---|---|---|
| docs-portal staging | `docs-portal-staging` (Firebase project, owned by `sanjeev-ai`) | Live docs, `portal_docs` collection |
| docs-portal prod | `docs-portal-prod` (Firebase project, owned by `sanjeev-ai`) | Live docs, `portal_docs` collection |

**There is no dev-preview environment for this repo, by design.**
`sync-docs.yml` only triggers on push to `master` and always runs
`syncDocs.ts --env=staging` — it never writes to `portal_docs_dev`. This
is intentional, not a gap: this repo has one branch and its docs don't
need a work-in-progress preview stage the way `sanjeev-ai`'s docs-portal
RBAC/admin screens did. Practical effect for anyone browsing the portal:
selecting the **Dev** toggle while viewing project `swarmkit` shows the
same content as **Staging**, because staging is the only collection this
repo ever populates. If that's ever no longer true (this repo grows a
`dev` branch), extend `sync-docs.yml`'s trigger to also fire on `dev` and
derive `--env` from `github.ref_name` instead of hardcoding it — don't
just add a second hardcoded copy of the workflow.

## Services per environment

### docs-portal (both staging and prod)
- Hosting: none — this repo has no UI of its own, its docs render inside
  the `sanjeev-ai` docs-portal app at `/swarmkit/...`
- Database: Firestore, `portal_docs` collection only (see above) — one
  document per synced file, ID `swarmkit_<slug-with-underscores>`
- Backend/functions: none
- Auth: none — the sync runs as a CI service account with Firestore write
  access, not an end-user identity

## Secrets and credentials

| Secret name | Credential store | Actually authenticates | Used by |
|---|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_DOCS_PORTAL_STAGING` | GitHub repo secret | `docs-portal-staging` (a `sanjeev-ai`-owned Firebase project, not this repo's own) | `.github/workflows/sync-docs.yml` |
| `FIREBASE_SERVICE_ACCOUNT_DOCS_PORTAL_PROD` | GitHub repo secret | `docs-portal-prod` (a `sanjeev-ai`-owned Firebase project) | `.github/workflows/sync-docs.yml` (via `workflow_dispatch` with `target: prod`) |

Both are literal copies of the same-named secrets in `sanjeev-ai`'s own
repo — there's no cross-repo/org-level secret sharing set up (GitHub
doesn't support that for personal-account repos without converting to an
Organization), so if either credential is rotated on the `sanjeev-ai`
side, it must be copied here again too. Confirmed present and working
2026-07-25.

## Known gaps

- No dev-preview stage — see "Environments" above. Deliberate, not a gap.
- If `sanjeev-ai` ever converts to a GitHub Organization, revisit whether
  these two secrets can become a shared org-level secret instead of two
  independently-maintained copies.

---
type: reference
tags: [infrastructure, deployment, reference]
status: template
---
# Infrastructure Map

**This file is a template.** Fill it in as soon as this project has real
infrastructure — a database, a hosting target, a cloud project, a secret.
The `Docs` agent owns keeping it current (see its `agent.json`); every
other role should read it before provisioning anything or debugging a
deploy, rather than rediscovering project IDs, secret names, and IAM state
live via CLI probing. That rediscovery is expensive and it's exactly the
kind of thing this file exists to make a one-time cost instead of a
recurring one.

## Why this file exists

A real swarm session on a sibling project spent a large amount of a
session's budget re-discovering infrastructure state that had never been
written down: which cloud project was which, why a GitHub secret's name
didn't match the project it actually authenticated against, which
environments had which services enabled, and which CI service account was
missing which IAM role. None of that was hard to find — it just had never
been recorded anywhere an agent could read it first. Don't repeat that.

## Environments

| Environment | Where it lives | Purpose |
|---|---|---|
| local / dev | _(e.g. local emulators, a dev cloud project)_ | |
| staging | _(project/account id)_ | |
| production | _(project/account id)_ | |

## Services per environment

For each environment above, list what's actually deployed there and where:

```
### <environment name>
- Hosting: <target/URL>
- Database: <type, region — note if the region is a one-time,
  irreversible choice>
- Backend/functions: <what's deployed, and importantly what is NOT —
  e.g. if only a subset of a shared codebase is deployed here, say why>
- Auth: <provider(s) enabled>
```

## Secrets and credentials

Don't put secret **values** here — this file is meant to be readable by
any agent, and in an OKF-based project it may end up broadly readable.
Record the **mapping**: which secret name, in which credential store,
authenticates against which environment. This is exactly the kind of
mapping that drifts silently (a secret gets renamed, or its underlying
credential gets rotated to point somewhere else) — if you ever confirm one
of these against the actual provider console, note the date you checked.

| Secret name | Credential store | Actually authenticates | Used by |
|---|---|---|---|
| | | | |

## Known gaps

Anything provisioned as a workaround, anything still missing (e.g. an IAM
role a CI service account needs but doesn't have yet), or anything that
looks inconsistent but hasn't been resolved. Future agents should see this
before they burn time rediscovering it, or worse, "fixing" something that
was already a deliberate workaround.

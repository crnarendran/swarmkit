---
type: reference
tags: [swarmkit, tooling, safety, dry-run, ci]
---
# Safe-by-Default Tooling

1. **A tool that writes, deletes or spends acts only when asked.** The
   default is a dry run. Acting needs an explicit `--apply` or `--live`.
   `--help` never touches anything. A script that ran live because a flag
   was missing, and a reseed that ran because someone asked for its usage,
   are the same bug.
2. **A regenerator must not own human decisions.** Rankings, approvals and
   ready flags must not live on records that a rebuild deletes and
   recreates. Mark derived records obsolete instead of deleting them, and
   never delete what you did not read.
3. **Paid calls:** model ids live in an allowlist together with their
   price; check availability with a free metadata call first; one approval
   buys one run, recorded where the work is specified; and resolution
   failures stop loudly, never fall back to a hard-coded default.
4. **A tool must refuse a stale checkout:** compare it with the remote
   before acting on what it reads.
5. **Every script must at least load in CI** (`node --check` or the
   language's equivalent). A dynamically imported script with a syntax
   error can sit broken for weeks.

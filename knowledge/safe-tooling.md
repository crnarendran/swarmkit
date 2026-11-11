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

## Test-run and shell hazards

1. **Read the exit code, not the counts.** "N passed" can sit beside a
   non-zero exit. Don't pipe the run into something that hides its
   status, and don't force it to exit.
2. **A killed test run can hold its fixed ports.** A test that fails
   locally and passes in CI may be meeting a previous run's orphan. Check
   the ports before blaming the code.
3. **Run tests in the CI's time zone** (usually UTC). Date logic that
   passes in your local zone can fail there.
4. **Random test data must not randomly hit an edge case.** A random hex id
   that is occasionally all digits parses as a number one run in many.
5. **An interrupted mutation run leaves its mutant in the source.** Diff
   before committing after one.
6. **The final run uses the real configuration,** with type checking on.
   A scratch configuration that skips type checks hides type errors until
   CI.
7. **Never put shell metacharacters in an inline commit message or inline
   script.** In a double-quoted shell string, backticks and `$(...)` run as
   commands. One such script ran a stray `gh pr create`. Pass commit
   messages through a quoted heredoc or a file, and edit files with an
   editing tool rather than an inline script.

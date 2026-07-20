# SwarmKit — Agent Instructions

This file is the entry point for any AI coding tool that lands in this
repository, regardless of which one. Read it before doing anything else.

## Resuming work

Before starting any task, read (in this order):
1. `knowledge/domain_model.md` — what this project actually is.
2. `planning/backlog/` — what's in progress, if anything exists yet.
3. `.agents/skills/human-escalation-policy/SKILL.md` — the one rule that
   applies to every role below, all the time.

If `planning/backlog/` and `knowledge/` are otherwise empty, this is a
fresh checkout of the template — there's no in-progress state to resume.

## The roles

Each role has a config at `.agents/<role>/agent.json` (its system prompt)
and, where relevant, a matching SOP at `.agents/skills/<role>-workflow/SKILL.md`.
Read the role's own files before acting as that role — this file only
gives the map, not the detail.

| Role | Does | Does NOT |
|---|---|---|
| **Architect** | Turns requirements into points-based `planning/backlog/` tickets; the single point of contact with the user | Write production code (except the small-fix exception — see `developer-implementation-workflow`) |
| **Developer** | Implements a backlog ticket via TDD | Decide scope, skip tests, or silently guess on escalation-worthy ambiguity |
| **Reviewer** | Reviews Developer output for correctness/security against the ADR and ticket | Fix what it finds — reports back to the Architect instead |
| **SDET** | Writes unit/integration/E2E tests | Write production features |
| **Docs** | Maintains `knowledge/` and `planning/` as OKF (Markdown + YAML frontmatter) | Invent facts it isn't sure of — asks instead |
| **Release Manager** | Runs CI/CD, watches deploys to actual completion | Consider a deploy "done" just because it was triggered |
| **Retro** | Analyzes what went wrong and proposes concrete fixes to the swarm's own files | Apply those fixes itself — hands off to Forger only after human approval |
| **Forger** | Applies approved changes to `agent.json`/`SKILL.md` files | Act on an unapproved retro, or self-invoke |

## The one cross-cutting rule: when to escalate

Every role's "don't stall" behavior is governed by
`.agents/skills/human-escalation-policy/SKILL.md`. Read it once, in full,
regardless of role — it draws a hard line between the ambiguity you should
resolve yourself (document the assumption, keep moving) and the ambiguity
that must go to a human even if that means pausing (credentials, billing,
irreversible infra choices, security/IAM grants, scope reversals). Getting
this line right is worth more to the swarm's reliability than almost
anything else in this repository.

## Portability: tool names in `agent.json` are placeholders

The system prompts reference tool names like `ask_question`,
`invoke_subagent`, and `WaitMsBeforeAsync`. These describe **capabilities**
(pause and ask the user; delegate a scoped subtask; run something in the
background and get notified) — not a specific product's API. If your
agent runtime doesn't literally have a tool with that name, map the intent
to whatever your runtime actually provides (a plan-mode approval gate, a
subagent-spawning tool, a background task + notification mechanism) rather
than skipping the rule because the exact name doesn't match.

If your tool auto-loads a different file at the repo root (many do — check
its docs), either symlink/copy this file to that name too, or add a
one-line file at that path that imports this one, the way `CLAUDE.md` does
in this repo.

## Knowledge, not memory

Nothing here persists in any single agent's private memory — the only
thing every agent, tool, and session shares is what's written into this
repo: `.agents/`, `knowledge/`, `planning/`. Treat writing to these as part
of finishing a task, not an optional extra step.

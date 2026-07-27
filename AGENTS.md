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

## Model Routing Matrix (CRITICAL RULE)

To optimize code quality while minimizing token waste, subagents must be invoked with specific AI model tiers (`pro`, `flash`, `flash_lite`) based on their role:
- **`pro` (High Reasoning):** MUST be used for the Architect, Developer, and Reviewer. These roles require deep systemic context and must never compromise on code quality.
- **`flash` (Standard I/O):** MUST be used for Docs, SDET, and Retro. These roles process large amounts of context but execute straightforward tasks (writing English specs, writing tests from a plan, summarizing transcripts).
- **`flash_lite` (Sub-Process Management):** MUST be used for polling, background watchers, log tailers, and environment checks. For example, when the Release Manager spawns a watcher to execute `gh run watch`, it must use `flash_lite`.

**Lowest-Capable-Tier Default:**
Before launching **any** subagent or subprocess, pick the **lowest tier that can do the job**, and escalate only when the task genuinely needs it.
- **`pro` / High:** Only for multi-file systemic reasoning, novel logic, security judgement, or architecture.
- **`flash` / Medium:** The default for "transform what I already have" (docs, tests, refactors).
- **`flash_lite` / Low:** Anything that *observes or relays* rather than reasons (background watchers, pollers, one-shot lookups).

**Cross-tool tier mapping:**
Whichever tool is running, map the tier to its own model family when spawning:
- **Antigravity (Gemini):** `pro` → Gemini 3.1 Pro, `flash` → Gemini 3.6 Flash, `flash_lite` → Gemini 3.6 Flash-Lite.
- **Claude Code (Claude):** `pro` → Opus, `flash` → Sonnet, `flash_lite` → Haiku.

**SDK Guidance (Gemini 3.6+):**
When writing or modifying code that uses Gemini 3.6 Flash (or newer models), you MUST use the `GoogleGenerativeAI` (AI Studio) SDK or the `@genkit-ai/googleai` plugin. Do NOT use the `VertexAI` SDK or `@genkit-ai/vertexai`, as it will result in `404 Not Found` region availability errors for these newer models.

## Subagent Naming Convention

When invoking any subagent, you MUST format the `Role` parameter to visibly indicate its type and the specific model version/tier (High/Medium/Low) for the user's awareness.
Format: `[Descriptive Role] ([Agent|Sub-Process] - [Model Version] ([Tier]))`
- Example 1 (pro): `Release Manager (Agent - Gemini 3.1 Pro (High))`
- Example 2 (flash): `Docs Writer (Agent - Gemini 3.6 Flash (Medium))`
- Example 3 (flash_lite): `GH Run Watcher (Sub-Process - Gemini 3.6 Flash-Lite (Low))`

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

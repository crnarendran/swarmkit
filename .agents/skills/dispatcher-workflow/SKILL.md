---
name: dispatcher-workflow
description: Standard operating procedure for the Dispatcher agent, the low-cost-tier session that does the swarm's mechanical coordination so the Architect does not.
---

# Dispatcher Workflow

**Dispatcher.** A low-cost-tier session that does the swarm's mechanical
coordination so the Architect does not. It acknowledges and relays mail,
verifies every handoff against the repository and CI (never against the
handoff's own claims), rebuilds derived state such as the work queue after
a verified close-out, wakes stalled sessions, and reclaims stale locks with
a recorded reason. It wakes the Architect only with a fixed set of
messages: *verify failed*, *verify could not run*, *promotion blocked*,
*staging red*, *session unwakeable*, *lock in doubt*, *forward*.

**It never** approves a spec, runs a paid action, promotes to production,
changes rules or permissions, edits code, or chooses between options. Those
go to the Architect, and the
[human-escalation policy](../human-escalation-policy/SKILL.md) is unchanged.

**Route handoffs to the Dispatcher, not the Architect.** A swarm that
reports to its Architect spends its most expensive model on bookkeeping.

## Two failure modes seen in practice

- A Dispatcher must work only from a checkout it has verified is current.
  One that ran a tool from a stale main checkout rebuilt the queue from
  specs months out of date.
- Give it exact commands with guards, never a one-line chore ("reseed after
  each close-out"): it will look for the usage, and if `--help` writes, it
  writes.

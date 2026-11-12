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

## Pulling work from a queue

1. **Only the Architect marks work ready.** It does so only when the spec
   says why, its dependencies are done, its verification steps are
   written, and any human decision it needs has been made.
2. **A claim is a dispatch, and the lease is the lock.** A session that
   claims a story starts it in the same turn, renews its lease at each
   significant step, and releases it at close-out. "Nothing ready" is an
   answer: the session goes idle with its watcher armed and does not look
   for work elsewhere.
3. **Pull needs a wake and permissions.** A session waiting only for mail
   never notices ready work, so its watcher must wake it for ready work
   too. Its claim tools must also be allowed before it runs unattended.
   Otherwise its first claim waits on a prompt nobody sees.
4. **Direct messages still win.** A session checks its mail before
   claiming from the queue.

## Two failure modes seen in practice

- A Dispatcher must work only from a checkout it has verified is current.
  One that ran a tool from a stale main checkout rebuilt the queue from
  specs months out of date.
- Give it exact commands with guards, never a one-line chore ("reseed after
  each close-out"): it will look for the usage, and if `--help` writes, it
  writes.

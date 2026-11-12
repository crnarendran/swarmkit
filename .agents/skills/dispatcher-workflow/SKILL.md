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

## Coordination economy

1. **Don't ask a session what a lookup can answer.** Every question to
   another session costs it a model turn, and a long-lived session's turn
   costs about ten times a fresh one's. Liveness, read receipts, lock
   holders, CI results and story status all have a free answer: a roster,
   a lock list, the CI history, the spec. A turn is for decisions.
2. **Retire heavy sessions at a batch boundary.** Once a session's context
   is near the ceiling, every cold wake rereads most of it. Close out its
   batch, release its locks and write down what it knows. Then start a
   successor from a short brief. Never retire mid-story, holding a lock,
   or holding knowledge that is not written down.
3. **One Architect per project.** When a swarm runs several projects, each
   project's escalations go to its own Architect. Only the dispatcher
   spans projects.
4. **When the reporting tool is broken, report through the next channel,
   and quote the exact error.** The ladder: the message tool; a note on
   your lock; the commit message; the human's chat. A fallback carries the
   report. It never does the broken tool's job by writing to that tool's
   storage directly.

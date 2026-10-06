---
name: checking-agent-quota
description: When to check whether an AI coding session is out of quota, which signal to trust for each tool, and how to read the answer without being fooled. Use before dispatching a batch, before promising an ETA, or when a session goes silent. Judgement only; the parsing lives in scripts.
---

# Checking Agent Quota

This skill is about **judgement**: when to look, what to look at, and how much
to believe the result. It does not restate how to parse anything. A skill that
reimplements a script in prose drifts from it silently, so the mechanics stay in
the scripts (below) and the record shapes stay in
[`knowledge/agent-runtime-internals.md`](../../../knowledge/agent-runtime-internals.md).

## The one fact that shapes everything

**A session that has run out of quota cannot tell you.** The runtime retries
briefly and then dies; there is no turn left in which to write a status. So the
check must come from **outside** the session, reading the durable records it
left behind. Never design around "the session will report its own limit".

## When to check

| Moment | Why |
|---|---|
| **Before dispatching a batch** | Handing work to a session that is already blocked loses the whole round trip. |
| **Before promising an ETA** | An ETA from a pool you have not looked at is a guess presented as a plan. |
| **When a session goes silent** | Silence has several causes (quota, crash, finished, stuck). Quota is the cheapest to rule in or out, so look first. If the quota check is clean, switch to the `session-forensics` skill. |

Do not poll on a timer from a reasoning model: every check then spends tokens
from the very pool you are worried about. Checks are cheap scripts; run them on
demand or from a plain, model-free watcher.

## Which signal, per tool

| Tool | Use | Do not use |
|---|---|---|
| **Claude Code** | Its session transcripts: they carry an exact, absolute reset time and name which limit was hit. Mechanics: the `claude-quota.mjs` script in the swarm ops runtime. | Guessing from a screenshot of a settings panel. |
| **Antigravity** | Its per-session conversation database, named by the session id. Mechanics: the `quota-status.mjs` script in the swarm ops runtime, which also reads the older log. | The shared log file as the primary source: it has no session attribution and is overwritten on every restart. |

For either tool, the vendor's own usage panel is the **only** account-wide
number. Transcripts and databases refine it for one machine; they cannot
replace it.

## How to read the result

1. **State the scope with the answer.** A reading is only as wide as the places
   it looked. Say "no rate limit on *this host* since *this time*; other devices
   not visible", never a bare "no rate limit". The limits are per account but the
   records are per device, so a second machine can sit minutes from a limit while
   this one reports all clear.
2. **"Cannot tell" is not "fine".** If a script reports that a record's format
   changed, the state is **unknown**. Treat it as a stop-and-verify, not as a
   pass. Re-check the record shapes against the internals document, and note the
   tool version.
3. **Blocked means unrecovered *and* still in the future.** A 429 being the last
   thing in a file proves nothing if its reset time was hours ago. Conversely, a
   later successful turn means the session recovered even if the limit has not
   technically reset.
4. **Read the reset as an absolute time.** Convert any countdown at the moment
   you read it. A countdown copied into a plan is stale as soon as it is
   written.
5. **Check whether paid overage was used.** Where the record says so, that is
   machine-checkable evidence. Do not accept "I stayed under the limit" as
   evidence; it is a promise, not enforcement.
6. **Do not reason from pool percentages.** Sessions have died on a
   per-individual limit while every visible gauge read healthy. A healthy-looking
   dashboard does not clear a silent session.

## What to do with the answer

- **Blocked, reset known:** reroute the work to another pool, or schedule it
  after the reset. Say which, and say the reset time.
- **Blocked, reset unknown or format changed:** do not guess. Report it and let
  a human decide.
- **Clear, but scoped to one host:** dispatch, but do not describe the account
  as clear.
- **Spending money is never the fix.** If the only way forward is paid credit or
  an overage pool, that is a human decision every time. Follow
  [`human-escalation-policy`](../human-escalation-policy/SKILL.md): stop and
  report.

## Anti-patterns

- Asking a blocked session to report its own quota.
- Printing "no rate limit" without a host and a time span.
- Treating a parser's "format changed" exit as a transient error and retrying
  until it goes away.
- Quoting record contents in a report. These files hold secrets; report fields,
  kinds and line numbers only.

---
name: session-forensics
description: How to answer "what did that session actually do, and why did it stop" from the records it left behind, instead of guessing. Locate a session by id, tell a quota 429 from a crash, recover a handoff the session never sent, and map an OS process id to a session. Use when a session goes dark or reports something that does not add up.
---

# Session Forensics

When a session goes quiet, the temptation is to guess: "it probably crashed", "the
watcher must have failed". Guesses here have been wrong in both directions: a
stale watcher read as "failed to self-recover" when the weekly pool had actually
run out, and unstable counts blamed on a parser when a **stale checkout** was
being read. The records below turn the guess into a lookup.

Record shapes, field names and the traps in them live in
[`knowledge/agent-runtime-internals.md`](../../../knowledge/agent-runtime-internals.md).
Read it first; this skill is the method, not the reference. Those records are
**undocumented internals**: verify a shape on a real file before relying on it.

## Ground rules

- **Read-only.** Forensics never edits a transcript, database or log. Open
  databases read-only; if one is locked, read a copy.
- **Report fields, kinds and line numbers. Never quote content.** These files
  hold prompts, paths and secrets, and your report will be copied into logs,
  messages and public repositories.
- **State your scope.** Every record here is per device. "I found nothing" means
  "nothing on this host". Say which host and which time span.
- **Say what you could not establish.** An unattributed fact is better than a
  confident wrong attribution.

## 1. Locate the session by its id

The id you hold may not be the id the files use. Check which you have:

| You have | Antigravity | Claude Code |
|---|---|---|
| The id the session registered under | It is the **file name** of the session's conversation database. Direct lookup. | It is **not** the transcript file name. Do not join by equality. |
| The transcript id | n/a | It is the transcript file name and the `sessionId` field inside it. |
| Only a working directory | n/a | Match transcripts whose `cwd` equals it and take the most recent. **Mark the match ambiguous**; never use an ambiguous match to suppress an alert. |

If the registered id and the transcript id are different for Claude Code, the
session itself is the only party that knows both. Look for a transcript id the
session recorded at registration. If none exists, fall back to the working
directory match and say it is a guess.

**Before trusting any file, check that it is the right checkout and the right
host.** A real, well-formed file from the wrong clone produces a confident wrong
answer, and it happened.

## 2. Tell a quota 429 from a crash

Work through these in order. Stop at the first that explains the silence.

1. **Is there an unrecovered rate-limit entry?** Find the latest 429 record for
   the session (Claude Code: a rate-limit error entry; Antigravity: a failed step
   mentioning `RESOURCE_EXHAUSTED`). Then check what follows it:
   - A later successful turn: the session **recovered**. Quota is not why it is
     silent now.
   - Nothing after it, and the reset time is still ahead: **quota-blocked**.
   - Nothing after it, and the reset time has passed: the 429 is stale. Look for
     another cause.
2. **Is the 429 the *real* reason, or only the last thing logged?** Antigravity
   surfaces a 429 to the model as "the stream was interrupted", which looks
   identical to a server hiccup from the inside. So a session that wrote only
   that line is **not** evidence of a non-quota failure. Check the database for
   the structured refusal.
3. **No 429 anywhere, and the last turn ends abruptly?** Then suspect a crash or
   a killed process. Corroborate before concluding: is the process still alive
   (section 4)? Does the file end mid-line? A truncated last line is normal for a
   session that was writing when it stopped, so it is a clue, not a verdict.
4. **Last turn is a normal completion?** The session may simply have finished
   and not told anyone. Go to section 3.
5. **None of the above?** Report "cause not established" with what you checked.
   Do not pick the most likely story.

A retry notice without a structured record is **normal** and not a refusal by
itself. A database that mentions `RESOURCE_EXHAUSTED` but has no structured
record at all means the format may have changed; say so.

If a tool reports "format changed", the answer is **unknown**. Do not retry it
until it passes.

## 3. Recover a handoff the session never sent

A session that stopped before reporting still left its work behind. Rebuild what
it did from its own records, not from memory of what it was asked to do:

1. **Find the last meaningful turns** in the transcript or database, and note
   timestamps. This gives the real stopping point.
2. **Reconcile with the repository, which is the ground truth.** Compare what
   the session says it committed with what exists: `git log` on the branch, the
   remote, and the reflog. A commit the session reported but that is absent from
   the remote did not land; say so rather than assuming. Unreachable commits can
   often be recovered from the reflog.
3. **Separate three things in the write-up:** what is verifiably done (present in
   the repository), what the session *claimed* (found only in its records), and
   what is unknown. Never merge these.
4. **Name the stopping cause** from section 2 and the earliest time the work can
   resume if it was quota.
5. **Send the handoff on the session's behalf only when asked, and say it is
   reconstructed.** A reconstructed handoff must not read as the session's own.

## 4. Map a process id to a session

| Source of the pid | What you can do |
|---|---|
| A Claude Code process | Claude Code keeps a small per-process record mapping the pid to a session id, working directory, version and entrypoint. Use it as a lookup. Its exact keys are **unverified** in this repository: open one file and confirm before building on it. |
| An Antigravity log line | The number in the log is a **goroutine id, not an OS pid**. It cannot be mapped to a session. Do not try; earlier attempts failed. Use the per-session database instead (section 1). |

If the mapping is uncertain, **record the observation against the pid and leave
the session unattributed.** A wrong attribution is worse than none.

On Windows, walking up a process tree needs repeated parent lookups. Cap the
walk (a handful of levels) and stop at the system pids, because a recycled pid
can otherwise loop.

## Anti-patterns

- Concluding "crashed" because the last line was an interruption message.
- Joining a registered session id to a Claude Code transcript by equality.
- Reading a real file from a stale checkout and trusting it.
- Treating a clean result on one machine as a clean result for the account.
- Quoting prompts, paths or tokens from a transcript in a report.
- Presenting a reconstructed handoff as the session's own.

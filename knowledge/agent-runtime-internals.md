---
type: reference
tags: [swarmkit, agent-runtime, claude-code, antigravity, quota, forensics]
---
# Agent Runtime Internals: where Claude Code and Antigravity keep state

> [!WARNING]
> **These are undocumented internals.** Neither vendor publishes or promises
> any file below. They can change in any release without notice. Everything here
> was observed on real data, not read from a spec. Treat each field as
> "true when last verified", and see [When a tool updates](#when-a-tool-updates).

## Verified against

| Tool | Versions | Notes |
|---|---|---|
| Claude Code | 2.1.246 to 2.1.255 | Record shapes were identical across all of them. A strict shape check also held across 20 Claude Code versions on one host, with no false alarms. |
| Antigravity | build not recorded | Conversation databases checked: 488 on one host, all with the same schema. The build number was not captured. Record it when you re-verify. |

Shapes below are as asserted by the ARK-4 format guard (`format-guard.js` and
its `quota-parsers.js` / `claude-usage.js` callers) in the swarm ops runtime
repo, at commit `3d962e6`. If that guard changes, this document is stale.
Sample records are synthetic: every id, path and number is a placeholder.

## Scope: four surfaces, nothing else

| # | Surface | Good for |
|---|---|---|
| 1 | `~/.claude/projects/<slug>/<transcript-id>.jsonl` | Exact per-turn token use. Structured 429 records with an absolute reset time. |
| 2 | `~/.claude/sessions/<pid>.json` | Mapping an OS pid to a session. |
| 3 | `~/.claude/history.jsonl` | Finding which session ran in which project. |
| 4 | Antigravity `conversations/<id>.db` (primary) and `logs/language_server.log` (fallback) | Antigravity 429s and their reset times. |

**Deliberately not documented:** `backups/`, `cache/`, `shell-snapshots/`,
`uploads/`, `plugins/`, `session-env/`. They are noise, they change often, and
documenting them would imply a verification nobody did.
`~/.claude/telemetry/` was **empty**. It is a dead end; do not investigate it
twice.

## Surface 1: Claude Code transcript (`<slug>/<transcript-id>.jsonl`)

One JSON object per line, appended as the session runs. A live transcript can
end mid-write, so a truncated last line is normal and must be tolerated.

**An assistant turn** (the fields that matter):

```json
{
  "type": "assistant",
  "timestamp": "2026-01-01T10:00:00.000Z",
  "sessionId": "<transcript-id>",
  "cwd": "<home>/projects/example-repo",
  "gitBranch": "feature-x",
  "message": {
    "id": "msg_EXAMPLE1",
    "role": "assistant",
    "usage": {
      "input_tokens": 2,
      "output_tokens": 410,
      "cache_read_input_tokens": 51000,
      "cache_creation_input_tokens": 930
    }
  }
}
```

**A 429 (rate-limit) entry:**

```json
{
  "type": "assistant",
  "error": "rate_limit",
  "isApiErrorMessage": true,
  "apiErrorStatus": 429,
  "sessionId": "<transcript-id>",
  "cwd": "<home>/projects/example-repo",
  "quotaLimits": {
    "status": "rejected",
    "resetsAt": "<epoch seconds: a 10-digit number>",
    "rateLimitType": "five_hour",
    "overageStatus": "rejected",
    "overageDisabledReason": "org_level_disabled",
    "isUsingOverage": false
  }
}
```

### Fields that matter, and the traps in them

| Field | Meaning | Trap |
|---|---|---|
| `message.usage.*` | Four numeric token counts per turn. All four were present on every assistant turn observed. | A missing field counted as 0 reports a confident, wrong "0 tokens". |
| `message.id` | Identifies the API response. | **One response is written as several lines** (one per content block), each carrying the same id and the same final usage. Summing lines overcounts by about 1.5x. Count each `message.id` once. |
| `error: "rate_limit"` | Marks a 429 line. Such a line spent nothing. | Skip it when summing usage. |
| `quotaLimits.rateLimitType` | Which limit: observed value `five_hour`. | Without it, the limit is guessed from the size of a countdown. That guess has been wrong. |
| `quotaLimits.resetsAt` | **Epoch seconds**, absolute. | Not milliseconds. Multiply by 1000 before comparing with `Date.now()`. |
| `quotaLimits.isUsingOverage`, `overageStatus` | Whether paid overage was consumed. | Observed `false` throughout. This is machine-checkable evidence, not a promise. |
| `sessionId` | The **transcript** id. | **Not** the id a session registers under elsewhere. The desktop app registers a `local_<uuid>`; the transcript file is named by a different uuid. Do not join the two by equality. |
| `cwd`, `gitBranch` | Where the session ran. | The fallback join when no transcript id is known. It can be ambiguous. |

**Recovered or still blocked?** A 429 is cleared by any later assistant turn
without `error: "rate_limit"`. Ordering alone is not enough: a 429 can be the
last line of a file whose window reset hours ago. Blocked means *not recovered
and `resetsAt` still in the future*.

## Surface 2: `~/.claude/sessions/<pid>.json`

Maps an OS process id to the session running in it. Per the original
investigation it carries the session id, working directory, Claude Code version
and entrypoint. It is the only pid-to-session mapping available; Antigravity has
none.

> [!NOTE]
> **Least-verified surface.** No parser reads this file, so no guard asserts its
> exact key names and there is no fixture to copy. Open one file and check the
> real key names before building on it. Do not trust this table for names.

## Surface 3: `~/.claude/history.jsonl`

One JSON object per line: command history, each entry tied to a session id and
a project. Use it to answer "which session ran in which project, roughly when".

> [!NOTE]
> Same caveat as surface 2: no parser reads it and no guard asserts its shape.
> Verify key names on a real file first.

## Surface 4: Antigravity

### Primary: `~/.gemini/antigravity/conversations/<session-id>.db`

A SQLite 3 file per session. **The file name equals the session id the session
registers under**, so no inference is needed. Node 24 has `node:sqlite`, so it
can be read with no dependency. Open read-only; on `SQLITE_BUSY`, copy the file
to a temp location and read the copy.

Table read: `steps(idx, step_type, status, step_payload)`.

| `step_type` | `status` | Meaning |
|---|---|---|
| 17 | 3 | An error step. A 429 is one whose payload text contains `RESOURCE_EXHAUSTED`. |
| 101 or 132 | 2 or 5 | A successful model step. One after a 429 means the session recovered. |

Payload of a structured refusal (synthetic):

```text
RESOURCE_EXHAUSTED (code 429) {"metadata": {"model": "example-model", "quotaResetDelay": "1h2m3s", "quotaResetTimeStamp": "2026-01-01T22:02:40Z"}}
```

**Most RESOURCE_EXHAUSTED rows carry no structured record.** About two thirds
(802 of 1,199 on the reference host) are a bare retry notice such as
`API error (attempt 1): RESOURCE_EXHAUSTED (code 429): Individual quota reached`.
That is normal. A database counts as having a usable refusal only if at least
one row carries all three of `model`, `quotaResetDelay` and
`quotaResetTimeStamp`. If RESOURCE_EXHAUSTED appears and no row does, the format
has probably changed.

### Fallback: `%APPDATA%/Antigravity/logs/language_server.log`

```text
ERROR: logging before google.Init: I<MMDD> HH:MM:SS.ffffff  <goroutine-id> http_helpers.go:42] attempt 1 failed: RESOURCE_EXHAUSTED (code 429) "Individual quota reached. Resets in 3h51m29s"
```

Use it only when the database is unavailable. Its weaknesses:

- **No session attribution.** The number after the timestamp is a **goroutine
  id, not an OS pid**. It cannot be mapped to a session, and attempts to do so
  failed.
- **Overwritten on every app start**, so a 429 from two days ago is gone.
- The reset is a **countdown** (`Resets in 3h51m29s`) to convert to an absolute
  time at parse time. A stored countdown is stale the moment it is written.
- No timestamp year or zone: the digits are local time.

## What each surface cannot tell you

- **Per-device only.** Every surface here records only sessions that ran on
  *this machine*. The five-hour and weekly limits are per *account*. A clean
  reading means "nothing on this host", never "the account is fine". Always name
  the host and the span covered. The usage figure in the vendor's own settings
  panel is the only account-wide number.
- **A session cannot report its own quota death.** The runtime retries twice,
  then dies; there is no turn left to write anything. Antigravity surfaces a
  429 to the model as "the stream was interrupted", which is identical from the
  inside to a server hiccup. Read the durable records from outside the process.
- **Pool percentages in a dashboard did not predict a 429.** Sessions died on a
  per-individual limit while the visible pools read healthy.

## When a tool updates

Parsers over these surfaces should assert the shape they expect and exit
non-zero with "format changed" rather than return a default. A quota checker
that quietly says "fine" after an update is worse than none.

- Assert only what was measured to be invariant. Absence is sometimes valid (a
  transcript with no 429 is simply `null`); a missing field on a record that
  should have it is not.
- Guard Antigravity per **database**, not per row (see above).
- Error messages name fields, kinds and line numbers. **Never quote a value**:
  these files contain secrets and error text gets copied into logs.
- When you re-verify after a version bump, update the version table at the top
  of this document.

This document should stay at four surfaces. If a field described here is not
read by any skill or script, delete it rather than maintain it.

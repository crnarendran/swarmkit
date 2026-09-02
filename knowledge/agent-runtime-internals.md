---
type: reference
tags: [agent-runtime, observability, rate-limits, token-accounting, claude-code, antigravity, reference]
status: filled
related:
  - infrastructure.md
---
# Agent Runtime Internals — Rate-Limit & Token Signals

Where the agent tools this swarm runs on record **token usage** and
**rate-limit / quota events** on the local disk, so a script or skill can read
them directly instead of estimating cost from screenshots of a settings panel.

Scope is deliberately narrow: **four file surfaces**, listed below. Everything
else under `~/.claude/` and Antigravity's data dir is explicitly out of scope
(see [§6](#6-out-of-scope-do-not-document-these)).

> **Every literal value below — hostnames, session IDs, paths, pids, epochs — is
> a placeholder.** Only the *field names and JSON structure* are the
> documentation; the values are illustrative and were scrubbed of the machines
> they came from.

---

## 0. Read this before trusting anything below

### These are undocumented internals

Neither vendor documents these files. They are observed, not specified.

| Runtime | Verified against | Observation |
|---|---|---|
| Claude Code | 2.1.246, 2.1.247, 2.1.255 | structure stable across all three |
| Antigravity language server | 2.11.0 | log format as described |

A release can change any field name, path, or format without notice. Anything
built on this **must** carry a version check (planned: ARK-4) and fail loudly
when the runtime version is outside the verified set, rather than silently
returning a wrong number.

### Signals are per-device; limits are per-account

Every file here is **local to one machine**. A parser running on laptop A sees
nothing of laptop B's sessions or history — but the rate limit it cares about is
enforced **per account, across every device**. So a parser on one machine can
confidently report *"no rate limit active"* while the account is one request
from a 429 on another.

**This is a silent wrong answer, not an error.** Any reading derived from these
files MUST be reported alongside:

- the **hostname** it was gathered on, and
- the **root path** that was scanned (`~/.claude`, the Antigravity logs dir).

Two independent installs were checked while writing this doc — see
[§7](#7-two-device-verification) for what that cross-check established and,
more importantly, what it did not.

---

## 1. `~/.claude/projects/<project-slug>/<session-id>.jsonl`

The full transcript of one session, one JSON object per line. `<project-slug>`
is the working-directory path with path separators and other non-alphanumerics
replaced by `-` (a repo at `C:\path\to\my-app` becomes `C--path-to-my-app`).
Alongside the `.jsonl` sits a directory of the same `<session-id>` and a
`memory/` dir; those are not part of this surface.

### 1a. Per-turn token usage

Every `type: "assistant"` line carries `message.usage`.

**Stable core — present on every version checked, write parsers against only these:**

```jsonc
"usage": {
  "input_tokens": 2,
  "cache_creation_input_tokens": 2025,
  "cache_read_input_tokens": 172273,
  "output_tokens": 1035,
  "output_tokens_details": { "thinking_tokens": 576 }
}
```

**Observed on some installs (2.1.255) — treat as optional, tolerate absence:**

```jsonc
  "server_tool_use": { "web_search_requests": 0, "web_fetch_requests": 0 },
  "service_tier": "standard",
  "cache_creation": { "ephemeral_1h_input_tokens": 2025, "ephemeral_5m_input_tokens": 0 },
  "inference_geo": "not_available",
  "iterations": [ { /* per-inference breakdown, same keys, "type": "message" */ } ],
  "speed": "standard"
```

One machine checked showed only the 5 core keys; another showed ~10. A parser
that assumes the larger shape breaks on the smaller one.

The assistant line also carries, at top level (not inside `message`):
`requestId`, `apiBlockIndex`, `effort`, `userType`, `entrypoint`, `version`,
`gitBranch`, `sessionId`, `cwd`, `timestamp` (ISO-8601, UTC, `Z`-suffixed).
**`version` is the field to gate a parser on.**

### 1b. Rate-limit / 429 records

> **SINGLE-SOURCE — observed on one machine only, not reproduced elsewhere.**
> The field names and structure below are from one install's transcripts (14
> events, all `rateLimitType: "five_hour"`, all `isUsingOverage: false`). A
> second independent install had **zero** rate-limit events, so none of this is
> cross-verified. Do not treat one machine's record as the schema — label any
> tool built on it accordingly.

When a request is rejected for rate-limiting, a record of this shape is written
into the same transcript:

```jsonc
{
  "text": "You've hit your session limit · resets 5:10am (Europe/London)",
  "quotaLimits": {
    "status": "rejected",
    "resetsAt": 1700000000,                        // epoch seconds — the useful field
    "rateLimitType": "five_hour",                  // which limit was hit
    "unifiedRateLimitFallbackAvailable": false,
    "overageStatus": "rejected",
    "overageDisabledReason": "org_level_disabled",
    "isUsingOverage": false
  },
  "error": "rate_limit",
  "apiErrorStatus": 429,
  "sessionId": "<session-id>", "cwd": "<repo-path>", "gitBranch": "<branch>",
  "userType": "external", "entrypoint": "claude-desktop"
}
```

Grep signature for a parser: lines matching `"error":"rate_limit"` or
`"apiErrorStatus":429` or `"quotaLimits"`.

---

## 2. `~/.claude/sessions/<pid>.json`

The **pid → session map**: given an OS process id, which session is it.
One file per live/recent interactive process. A sibling
`<pid>.<hash>.key` file exists (IPC key material) and is not part of this
surface.

**Stable core — every version:** `pid`, `sessionId`, `cwd`, `startedAt`
(epoch ms), `version`, `kind`, `entrypoint`, `pidDomain`.

```jsonc
{
  "pid": 10000,
  "sessionId": "<session-id>",
  "cwd": "<repo-path>",
  "startedAt": 1700000000000,
  "version": "2.1.255",
  "kind": "interactive",
  "entrypoint": "claude-desktop",
  "pidDomain": "win32:<hostname>",              // "<platform>:" + lowercased hostname

  // observed on 2.1.255, treat as optional:
  "procStart": "1340000000000000000",
  "peerProtocol": 1,
  "peerFeatures": ["notify_idle", "artifact_yield"],
  "messagingSocketPath": "\\\\.\\pipe\\LOCAL\\cc-msg-<hash>",
  "name": "<session-name>",
  "nameSource": "user",
  "nameSince": 1700000000000,
  "bridgeSessionId": "<bridge-session-id>",
  "updatedAt": 1700000000000
}
```

The `name` / `nameSource` fields are how a session's friendly name (e.g. its
SwarmOps registration name) is resolved from its pid.

---

## 3. `~/.claude/history.jsonl`

Append-only log of prompts submitted, one object per line:

```jsonc
{ "display": "<the prompt text>", "timestamp": 1700000000000,
  "project": "<cwd>", "sessionId": "<session-id>" }
```

Use it to attribute activity to a session over time without parsing the full
transcript. **May be absent** — one of the two machines checked had no such
file. A parser MUST treat a missing file as "no history on this machine", never
as an error, and never infer that history is empty account-wide.

---

## 4. Antigravity — `%APPDATA%/Antigravity/logs/language_server.log`

Antigravity has no structured usage record. The only rate-limit signal is a log
line in the language-server log:

```
ERROR: logging before google.Init: I0902 00:37:16.457352  180831 run.go:371] Run: attempt 1 failed (RESOURCE_EXHAUSTED (code 429): Individual quota reached. Resets in 3h51m29s.)
```

Every trap here was verified the hard way and each has produced a wrong answer
to a user at least once:

| Trap | Detail |
|---|---|
| **The number is a goroutine id, not a pid** | The integer after the timestamp (`180831` above) routinely exceeds 65535, which Windows pids cannot. Session attribution from it is **impossible** — an experiment to do so was run and abandoned. |
| **No year in the timestamp** | Format is `<severity><MMDD> <HH:MM:SS.micros>`. Infer the year from the file's mtime. |
| **Timestamps are local, not UTC** | *(single-source — reported, not reproduced.)* Misreading this once told a user a reset was 4 hours later than reality. |
| **`ERROR: logging before google.Init:` prefixes every line** | Regardless of real severity (the real level is the `I`/`W`/`E` letter after the prefix). Logger noise, not an error — confirmed on every line of a 274-line sample. |
| **Reset is a countdown string** | `"Resets in 3h51m29s"` — must be added to the line's timestamp to get an absolute time; there is no epoch field. |

Grep signature: `RESOURCE_EXHAUSTED` or `attempt \d+ failed`.

> Sibling file `%APPDATA%/Antigravity/logs/main.log` uses a **different** format —
> `[YYYY-MM-DD HH:MM:SS.mmm] [level] message`, with a full year and brackets. It
> carries app lifecycle events, not quota signals. Don't point a quota parser at
> it.

---

## 5. Why the Claude Code signal is better

Put this comparison where anyone choosing what to instrument will see it:

| | Antigravity | Claude Code |
|---|---|---|
| **Reset time** | countdown string in a log line | **`resetsAt`, epoch seconds** |
| **Which limit was hit** | not stated — must be inferred (and has been inferred wrong) | **`rateLimitType`** (e.g. `five_hour`) |
| **Session attribution** | goroutine ids, unmappable to a process | **`sessionId` in the record** |
| **Overage status** | invisible | **`isUsingOverage`, `overageStatus`** |
| **Format stability** | log-line text, may reword | JSON keys, stable across 3 releases |

---

## 6. Out of scope — do NOT document these

Recorded here so nobody re-investigates them:

- `~/.claude/backups/` — per-session file backups
- `~/.claude/session-env/` — per-session env snapshots
- `~/.claude/shell-snapshots/` — captured shell rc state
- `~/.claude/telemetry/` — **empty when present, and absent on some installs.**
  One machine checked had it as an empty dir; another did not have it at all.
  Nothing to parse either way.
- Antigravity `Cache/`, `Code Cache/`, `GPUCache/`, `Local Storage/`, `DIPS*`,
  and `*.log` other than `language_server.log`

**The test for adding any field or file to this doc:** does a script or skill
actually read it? If not, leave it out. A reference that catalogues fields
nobody consumes rots silently — the first sign it is stale is someone trusting
a wrong value from it.

---

## 7. Two-device verification

This doc was drafted from a brief gathered on **Machine A** and then checked
against a second independent install, **Machine B** (Claude Code 2.1.255,
`claude-desktop` entrypoint, Antigravity language server 2.11.0). Both are
Windows. Machine identifiers on both sides have been scrubbed.

### Confirmed on both machines

- `~/.claude/projects/<slug>/<session-id>.jsonl` layout, and `message.usage` on
  every assistant line carrying the five core token fields.
- `~/.claude/sessions/<pid>.json` with the stable core fields and `pidDomain` in
  the form `<platform>:<lowercased-hostname>`.
- Antigravity `language_server.log`: the `ERROR: logging before google.Init:`
  prefix on **every** line (274/274 in the sample), the yearless
  `I<MMDD> HH:MM:SS.micros` timestamp, and the goroutine-id-not-pid integer
  position.

### Differed between the two machines

| | Machine A (brief) | Machine B (this check) |
|---|---|---|
| `~/.claude/history.jsonl` | present | **absent** |
| `~/.claude/telemetry/` | present, empty | **absent** |
| `message.usage` | 5 keys | ~10 keys (superset) |
| `sessions/<pid>.json` | core fields only shown | core + `name`/`nameSource`/`bridgeSessionId`/`peerFeatures` |

The consistent pattern is **additive**: the newer install has a superset. So
the doc asserts only the intersection as stable, and marks the rest optional.

### NOT verified — still single-source

- **The rate-limit / 429 record shape (§1b).** Machine B's transcripts and
  Antigravity log contain zero quota-rejection events, so the `quotaLimits`
  field names, `resetsAt`, and `rateLimitType` values are **not** independently
  reproduced. The first install to hit a 429 with a parser watching should
  re-confirm that block.
- **"Antigravity timestamps are local, not UTC" (§4).** Reported in the brief;
  not reproducible without a dated event to anchor against.

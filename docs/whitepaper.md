# The SwarmKit White Paper
## Bootstrapping Scalable Agentic Development Environments

**Abstract**
As large language models (LLMs) continue to evolve, the bottleneck in AI-driven software development is no longer the intelligence of the model itself, but rather the orchestration of its capabilities. Single-agent systems, while powerful for discrete tasks, degrade rapidly as project complexity, context limits, and scope increase. Inspired by the architecture used in `sanjeev-ai`, **SwarmKit** introduces a multi-agent framework designed to emulate a mature software engineering organization. By separating concerns into distinct, specialized roles (Architect, Developer, Reviewer, SDET, Docs, Release Manager, Retro, and Forger), and by routing each of those roles to the *cheapest model capable of doing its job*, SwarmKit provides a blueprint for scalable, high-quality, autonomous software development that stays economical at scale and portable across agent runtimes.

---

### 1. The Limitations of Single-Agent Systems

When a single AI agent is tasked with building a full application, several systemic failures commonly occur:
1. **Context Saturation:** The agent must hold the entire product vision, implementation details, testing strategy, and deployment configuration simultaneously.
2. **Loss of Objectivity:** A single agent cannot effectively review its own code. It suffers from the same "tunnel vision" that a human developer does, overlooking structural flaws and security vulnerabilities.
3. **Scope Creep & Hallucination:** Without clear boundaries, agents tend to over-engineer solutions or hallucinate implementations outside their immediate requirements.
4. **Uniform-Model Cost Inefficiency:** A single agent runs every action — from architecting a subsystem to tailing a log file — on one model tier. Using a frontier-grade model to poll a CI job is as wasteful as using a junior engineer's entire day to watch a progress bar. Cost scales with the *most* expensive thing the agent ever does, applied to *everything* it does.

---

### 2. The Swarm Architecture

To overcome these limitations, SwarmKit enforces strict **Separation of Concerns**. Agents are given specific identities, constrained responsibilities, and clear input/output expectations.

#### 2.1 The Planning Layer
- **Architect:** The orchestrator of the swarm and the single point of contact with the user. The Architect never writes production code (save a narrowly-scoped small-fix exception). Instead, it synthesizes requirements into points-based backlog tickets, generates detailed implementation plans, and delegates discrete tasks to subagents.

#### 2.2 The Execution Layer
- **Developer:** The implementation specialist. Focused solely on writing clean, efficient code that adheres strictly to the Architect's plan, via test-driven development.
- **Docs:** The technical writer. Operates in parallel with the Developer to ensure API specs, design documents, and user manuals are always up-to-date — and never invents facts it isn't sure of.

#### 2.3 The Quality Assurance Layer
- **Reviewer:** The static analysis expert. Reviews the Developer's output for anti-patterns, security vulnerabilities, and adherence to the original plan — and reports findings back to the Architect rather than fixing them itself, preserving the separation between author and critic.
- **SDET (Software Development Engineer in Test):** The automated testing specialist. Writes unit, integration, and end-to-end tests to ensure the Developer's code meets rigorous quality gates.

#### 2.4 The Deployment & Evolution Layer
- **Release Manager:** The DevOps specialist. Manages CI/CD pipelines, version control, and safe deployments to staging and production environments — and is responsible for watching every deployment through to a real terminal status, not just triggering it and moving on.
- **Retro:** The process-improvement engine. Analyzes completed work for structural gaps in the framework and proposes concrete fixes — but requires explicit human approval before any change reaches the other agents' configurations.
- **Forger:** The meta-agent. Applies approved configuration changes to `agent.json`/`SKILL.md` files to adapt the swarm to new challenges, but only ever on an approved Retro handoff, never on its own initiative.

#### 2.5 Shared Memory via Open Knowledge Format (OKF)
A multi-agent system is only as good as its shared context. SwarmKit integrates the **Open Knowledge Format (OKF)** to provide a standardized, portable knowledge graph. By representing organizational knowledge, business logic, and system metadata as interconnected Markdown files with YAML frontmatter, OKF allows agents to independently navigate and retrieve exactly the context they need, when they need it, eliminating the "Context Saturation" problem. The governing principle is **knowledge, not memory**: nothing persists in any single agent's private state — the shared repository (`.agents/`, `knowledge/`, `planning/`) is the only durable substrate, and writing to it is part of finishing a task, not an optional extra.

---

### 3. The Economic Layer: Model-Tier Routing

Specialization by *role* solves for quality and context. SwarmKit adds a second, orthogonal axis of specialization — by *model tier* — that solves for cost. This directly answers the fourth failure mode of single-agent systems: the framework refuses to run cheap work on expensive models.

#### 3.1 Three Tiers
Every agent and subprocess is invoked at one of three capability tiers, mapped to a role's actual cognitive demand:

| Tier | Cognitive demand | Roles / work |
|---|---|---|
| **`pro` (High)** | Multi-file systemic reasoning, novel logic, security judgement | Architect, Developer, Reviewer |
| **`flash` (Medium)** | "Transform what I already have" — deterministic-ish work over large context | Docs, SDET, Retro (specs from a plan, tests from a spec, summarizing a transcript) |
| **`flash_lite` (Low)** | *Observe or relay*, don't reason | Every background subprocess: watchers, pollers, log tailers, environment/health checks, one-shot lookups |

#### 3.2 The Lowest-Capable-Tier Default
The matrix above is a **floor, not a target**. Before launching *any* subagent or subprocess, the swarm picks the lowest tier that can plausibly do the job and escalates only when the task genuinely demands it. Reaching for `pro` "to be safe" is treated as the anti-pattern, not the cautious choice.

#### 3.3 The Background-Watcher Rule
The single most common source of waste is attaching an expensive reasoning model to a long-lived I/O wait. SwarmKit makes this an explicit prohibition: **never attach a `pro`/`flash` model to a background watcher.** A subprocess whose entire job is "wait for a condition and report it" — `gh run watch`, a deploy poller, a file-change listener — is always `flash_lite`. It wakes the orchestrator on the event; the *reasoning* then happens on whatever tier the next step warrants.

#### 3.4 Fallback Escalation
Because the default is deliberately aggressive about running cheap, SwarmKit pairs it with a self-correction loop. If a `flash` or `flash_lite` subagent repeatedly fails its task, the orchestrator terminates it, respawns it one tier higher, and triggers the **Retro → Forger** loop to update that task's SKILL file — so the escalation becomes permanent and the swarm never re-learns the same lesson. The tiering is thus not a static assignment but a system that converges on the right cost/capability point per task over time.

---

### 4. Portability Across Agent Runtimes

SwarmKit is a *portable boilerplate*, not an implementation bound to one vendor or one IDE. `sanjeev-ai` itself is developed across two different agent runtimes (Google Antigravity and Claude Code) against the same repository, and the framework is designed so a third adopter can drop it onto an entirely different stack.

#### 4.1 Tool Names Are Capabilities, Not APIs
The role prompts reference tools like `ask_question`, `invoke_subagent`, and a background-task primitive. These name **capabilities** — pause and ask the user; delegate a scoped subtask; run something in the background and get notified — not a specific product's API. An adopter maps each capability to whatever their runtime actually provides (a plan-mode approval gate, a subagent spawner, a task-plus-notification mechanism) rather than skipping a rule because the literal tool name is absent.

#### 4.2 Model Tiers Are Model-Agnostic
The `pro`/`flash`/`flash_lite` tiers are abstractions. Each runtime maps them to its own model family at spawn time:

- **Antigravity (Gemini):** `pro` → Gemini 3.1 Pro · `flash` → Gemini 3.6 Flash · `flash_lite` → Gemini 3.6 Flash-Lite
- **Claude Code (Claude):** `pro` → Opus · `flash` → Sonnet · `flash_lite` → Haiku

A naming convention makes the choice legible to the human supervising a run — every spawned agent is labelled with its type and the concrete model/tier it is using (e.g. `Reviewer (Agent - Opus (High))`, `GH Run Watcher (Sub-Process - Haiku (Low))`).

#### 4.3 Portable Rules vs. Project-Specific Gotchas
A recurring discipline keeps the template reusable: **vendor- or project-specific facts must not masquerade as universal swarm rules.** A concrete SDK incompatibility, an infrastructure endpoint, a deploy quirk — these belong in the adopting project's own config and knowledge base, recorded as *examples* the reader adapts, not as MUSTs baked into the portable rulebook. The rulebook carries the *shape* of the rule ("record your stack's SDK gotcha where your code guidance lives"); the project supplies the specifics.

---

### 5. Governance: Autonomy Without Recklessness

Non-stalling execution and human oversight are not in tension. SwarmKit resolves them with a single, sharp line drawn by the `human-escalation-policy`, which every role reads regardless of specialty.

- **Assume and proceed** for ordinary ambiguity (naming, scoping, a missing convention): pick the reasonable interpretation, document *why*, and keep moving. An agent that asks about everything is as unhelpful as one that asks about nothing.
- **Stop and escalate** for the narrow class of decisions where a wrong guess is expensive or irreversible: credentials and secrets, billing-affecting or cost-incurring changes, irreversible infrastructure choices (data location, deletion, force-pushes), and security/IAM grants — plus any reversal of a decision the human already made.

The **Retro → Forger approval gate** applies exactly this principle to the swarm modifying *itself*: any agent may propose changes to the framework's own configuration freely, but nothing self-applies without a human checkpoint. The system can evolve its own rules, but never behind the operator's back.

---

### 6. Benefits of the Swarm Approach

1. **Natural Quality Gates:** Code cannot reach production without passing through the Reviewer and the SDET. This prevents broken code from overwriting working systems.
2. **Parallel Execution:** While the Developer writes the backend logic, the SDET can write the test assertions and the Docs agent can draft the API spec — drastically reducing time-to-delivery.
3. **Domain Expertise:** Agents can be equipped with tools specific to their roles. The Reviewer gets static analysis tools, while the SDET gets access to a headless browser for E2E testing.
4. **Cost Efficiency by Construction:** Model-tier routing means the swarm spends frontier-model tokens only on frontier-grade problems. Watchers, pollers, and mechanical transforms run cheap by default, and Fallback Escalation ensures the few tasks that need more get it — without a blanket upgrade of everything.
5. **Runtime Independence:** Because tools and model tiers are abstractions, the same framework runs on different agent products and different model vendors, and can migrate between them without a rewrite.
6. **Autonomy Without Recklessness:** A narrow, explicit escalation boundary lets the vast majority of work proceed without a human in the loop, while guaranteeing a checkpoint precisely where a wrong guess would be costly — including when the swarm edits itself.

---

### 7. Real-World Applications

The SwarmKit architecture enables fully autonomous handling of complex workflows:
- **Zero-Day Vulnerability Patching:** The Release Manager detects a CVE. The Architect plans the patch. The Developer writes the code. The SDET runs regression tests. The Reviewer audits the fix. The Release Manager deploys it — and a `flash_lite` watcher, not an expensive model, tails the rollout to completion.
- **Large-Scale Refactoring:** Migrating thousands of lines of code from a legacy framework to a modern stack incrementally, with automated tests ensuring no loss of feature parity.
- **Continuous Documentation:** Maintaining a "living" repository where every code change automatically triggers updates to the internal wiki and external API documentation.

---

### 8. Conclusion

SwarmKit provides the fundamental scaffolding required to move from experimental AI coding assistants to robust, autonomous software engineering teams. By combining a specialized swarm architecture with cost-aware model-tier routing, runtime portability, and a sharp autonomy/oversight boundary, teams can build more complex, reliable, and secure software systems at an unprecedented velocity — economically, and without locking themselves to a single tool or model vendor.

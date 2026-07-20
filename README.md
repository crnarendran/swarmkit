# SwarmKit 🐝

> **A template repository for bootstrapping scalable agentic software development teams.**

SwarmKit is an opinionated boilerplate for building multi-agent AI systems, inspired by the architecture used in `sanjeev-ai`. It provides the scaffolding necessary to set up a virtual software organization where specialized AI agents collaborate to plan, develop, test, and release software seamlessly. For a deeper dive into the architecture and theoretical framework, please read the [SwarmKit Whitepaper](docs/whitepaper.md).

## Why SwarmKit?

Single-agent systems often struggle with context limits, scope creep, and a lack of self-reflection when building complex software. The **Swarm Architecture** solves this by dividing labor across highly specialized roles:
- **Separation of Concerns:** Just like human teams, agents perform better when their scope is narrow and clearly defined.
- **Built-in Quality Gates:** Reviewers and SDETs act as natural boundaries to prevent hallucinations from reaching production.
- **Infinite Scalability:** Easily forge new specialized agents as your project grows.

---

## Core Framework Policies

SwarmKit agents are bound by strict system constraints to ensure autonomy and velocity:
1. **Escalation Policy:** Agents don't stall on ordinary ambiguity — they document an assumption and keep moving. But a specific, narrow set of decisions always goes to the human first, even if that means pausing: credentials and secrets, billing-affecting infrastructure changes, irreversible choices (a database region, a deleted resource), security/IAM grants, and reversals of a decision the human already made. See [`human-escalation-policy`](.agents/skills/human-escalation-policy/SKILL.md) — this is the rule most likely to bite silently if skipped, so it's a hard line, not a suggestion.
2. **Asynchronous Execution:** Long-running commands (e.g., test suites) are launched as background tasks using native event-driven wakeups.
3. **Points-Based Planning:** The Architect breaks down requirements into discrete features estimated by story points (e.g., 1, 2, 3, 5, 8) to ensure manageable iterations.
4. **Retro Requires Approval:** The Retro agent proposes changes to the swarm's own `agent.json`/`SKILL.md` files, but the Forger may only apply them after the human explicitly approves — a self-modifying swarm without that checkpoint can drift its own operating rules silently.

---

## The Open Knowledge Format (OKF) & Folder Structure 🧠

SwarmKit strictly separates dynamic planning state from static project knowledge to prevent "Context Saturation". Both use the **Open Knowledge Format (OKF)** (Markdown with YAML frontmatter tags).

```text
c:/Naren/SwarmKit/
├── AGENTS.md                   # Entry point — read this first, any tool
├── CLAUDE.md                   # Imports AGENTS.md so Claude Code auto-loads it
├── .agents/                    
│   ├── architect/              
│   ├── developer/              
│   └── skills/                 # SOPs (e.g., architect-planning-workflow,
│                                #   human-escalation-policy, e2e-testing-gotchas)
├── planning/                   # Dynamic project state
│   ├── archive/                # Completed tasks and deprecated specs
│   └── backlog/                # Points-based feature tickets
├── knowledge/                  # Static Open Knowledge Format (OKF) graph
│   ├── adr/                    # Architecture Decision Records
│   ├── domain_model.md         
│   └── infrastructure.md       # Environments, services, secret mapping, known gaps
├── docs/                       # Auto-generated project documentation
├── src/                        # Core application code
├── tests/                      # Automated test suites
├── ci/                         # Deployment pipelines
└── README.md
```

Agents traverse this graph using standard Markdown links. For example, a ticket in `planning/backlog` will directly link to an `[ADR](file:///.../knowledge/adr/001-architecture.md)` explaining the design choices.

If your agent tool auto-loads a different root file than `CLAUDE.md`, add
a one-line import for it too — the goal is that `AGENTS.md` loads
automatically no matter which tool opens this repo, not just one.

---

## The Agents 👥

This repository comes pre-configured with the following roles in the `.agents` directory:

1. 🏗️ **Architect**: Translates user requirements into points-based implementation plans.
2. 💻 **Developer**: Writes production code iteratively according to the Architect's plans.
3. 🛡️ **Reviewer**: Reviews code for best practices, security, and alignment with requirements.
4. 📝 **Docs**: Maintains project documentation and enforces OKF YAML tags.
5. 🧪 **SDET** (Software Development Engineer in Test): Writes automated tests and ensures high code coverage.
6. 🚀 **Release Manager**: Orchestrates CI/CD pipelines, staging deployments, and production rollouts — and watches every deploy through to a real pass/fail, not just triggers it.
7. 🔁 **Retro**: Analyzes what went wrong after a sprint and proposes concrete fixes to the swarm's own files — but requires human approval before anything is actually changed.
8. 🔨 **Forger**: Applies approved changes to agent configurations and `.agents/skills` to evolve the swarm dynamically.

---

## Inspiring Examples 💡

Here are a few ways you can use SwarmKit to bootstrap complex workflows:

### Example 1: The "Zero-Day Response" Swarm
**Scenario:** A critical vulnerability is discovered in a production dependency.
1. The **Release Manager** detects the CVE and alerts the Architect.
2. The **Architect** plans an emergency patch and spawns the Developer and SDET.
3. The **Developer** updates the dependency and refactors the breaking changes.
4. The **SDET** writes regression tests specifically targeting the patched module.
5. The **Reviewer** performs a security audit on the PR.
6. The **Release Manager** automatically triggers a hotfix deployment.

### Example 2: The "Legacy Migration" Swarm
**Scenario:** Migrating a monolithic Express.js app to Next.js App Router.
1. The **Architect** analyzes the monolith and creates an iterative migration plan in `planning/backlog/`.
2. The **Developer** tackles one 3-point route at a time.
3. The **SDET** writes Playwright end-to-end tests to ensure feature parity.
4. The **Docs** agent simultaneously writes ADRs in `knowledge/adr/` for the new architecture.

## Quickstart 🚀

1. **Use this template:** Click "Use this template" on GitHub.
2. **Review the workflows:** Read `AGENTS.md` first, then `.agents/skills/` — especially `human-escalation-policy`, which every role depends on.
3. **Deploy:** Point your agent framework to the `.agents` directory and let the Architect take the lead!

## License
MIT

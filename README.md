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
1. **Non-Stalling Policy:** Agents will **never** block execution waiting for human input. If ambiguity arises, subagents document it and pass control back to the Architect, who acts as the single point of contact.
2. **Asynchronous Execution:** Long-running commands (e.g., test suites) are launched as background tasks using native event-driven wakeups.
3. **Points-Based Planning:** The Architect breaks down requirements into discrete features estimated by story points (e.g., 1, 2, 3, 5, 8) to ensure manageable iterations.

---

## The Open Knowledge Format (OKF) & Folder Structure 🧠

SwarmKit strictly separates dynamic planning state from static project knowledge to prevent "Context Saturation". Both use the **Open Knowledge Format (OKF)** (Markdown with YAML frontmatter tags).

```text
c:/Naren/SwarmKit/
├── .agents/                    
│   ├── architect/              
│   ├── developer/              
│   └── skills/                 # SOPs (e.g., architect-planning-workflow)
├── planning/                   # Dynamic project state
│   ├── archive/                # Completed tasks and deprecated specs
│   └── backlog/                # Points-based feature tickets
├── knowledge/                  # Static Open Knowledge Format (OKF) graph
│   ├── adr/                    # Architecture Decision Records
│   └── domain_model.md         
├── docs/                       # Auto-generated project documentation
├── src/                        # Core application code
├── tests/                      # Automated test suites
├── ci/                         # Deployment pipelines
└── README.md
```

Agents traverse this graph using standard Markdown links. For example, a ticket in `planning/backlog` will directly link to an `[ADR](file:///.../knowledge/adr/001-architecture.md)` explaining the design choices.

---

## The Agents 👥

This repository comes pre-configured with the following roles in the `.agents` directory:

1. 🏗️ **Architect**: Translates user requirements into points-based implementation plans.
2. 💻 **Developer**: Writes production code iteratively according to the Architect's plans.
3. 🛡️ **Reviewer**: Reviews code for best practices, security, and alignment with requirements.
4. 📝 **Docs**: Maintains project documentation and enforces OKF YAML tags.
5. 🧪 **SDET** (Software Development Engineer in Test): Writes automated tests and ensures high code coverage.
6. 🚀 **Release Manager**: Orchestrates CI/CD pipelines, staging deployments, and production rollouts.
7. 🔨 **Forger**: Modifies agent configurations and `.agents/skills` to evolve the swarm dynamically.

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
2. **Review the workflows:** Read `.agents/skills/` to understand the default SOPs.
3. **Deploy:** Point your agent framework to the `.agents` directory and let the Architect take the lead!

## License
MIT

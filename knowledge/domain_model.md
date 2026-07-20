---
type: concept
tags: [swarmkit, core-domain, architecture]
---
# The SwarmKit Domain Model

This is an example of an **Open Knowledge Format (OKF)** file. OKF provides a standardized, vendor-neutral way to represent knowledge that AI agents can easily parse and navigate.

## Overview
The SwarmKit architecture relies on specialized subagents. When an agent is spawned, it can be provided with a link to this OKF file to instantly understand the context of the project.

## Related Concepts
- **Agent Roles**: See `knowledge/roles.md` for definitions of the Architect, Developer, Reviewer, etc.
- **Workflow**: See `knowledge/workflow.md` for the standard operating procedures of the swarm.

## Graph Navigation
By using standard Markdown links, AI agents can traverse the knowledge graph to resolve missing context without hallucinating.

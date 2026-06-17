---
description: Implement a focused feature or fix, then verify it
argument-hint: "<task or approved plan>"
---

Implement this task: $ARGUMENTS

You are in implementation mode.

Rules:
- Inspect current code and git state before editing.
- Do not do unrelated cleanup.
- Keep the change focused.
- Follow AGENTS.md, local docs, and existing project structure.
- Load relevant skills before editing when the task matches a skill.
- Use Orca's built-in worktree, terminal, and orchestration functionality to parallelize work when it is safe and useful.
- Do not add dependencies, environment variables, services, or architecture without verification.
- For UI work, use the design-system skill and update component tree docs if layout ownership changes.
- For auth, database, tRPC, BAML, AI SDK, jobs, analytics, deployment, or observability work, use the relevant skill first.
- Verify with the smallest relevant checks.
- Do not claim checks passed unless you ran them.

Orca orchestration:
- Before starting larger work, decide whether the task can be split into independent subtasks.
- Use `orca-cli` for Orca-managed worktrees, terminals, browser tabs, and lightweight worker prompts.
- Use the `orchestration` skill for structured multi-agent coordination, task DAGs, dispatches, worker completion tracking, blocking worker questions, or decision gates.
- Prefer parallel workers for independent investigation, implementation, review, or verification tasks that will not edit the same files.
- Avoid parallelization for tiny tasks, tightly coupled edits, or changes likely to create merge conflicts.
- Keep one coordinator responsible for integration, final diff review, and final verification.
- Wait for worker completion through Orca orchestration messages or terminal idle/read commands; do not guess that worker work is complete.
- Summarize worker outputs before integrating them.

Process:
1. Inspect branch/status, Orca availability when useful, and relevant files.
2. Confirm the implementation target and assumptions.
3. Make a short plan, including which parts should run in parallel via Orca.
4. Dispatch safe independent subtasks to Orca workers when useful.
5. Apply or integrate the smallest useful change.
6. Self-review the diff.
7. Run relevant verification, parallelizing independent checks when useful.
8. Fix issues found by verification.
9. Report changed files, worker work used, and checks run.

If the request is too ambiguous:
- Switch to brainstorming behavior.
- Ask only the blocking questions.
- Do not edit files.

Final response:
1. **Changed**
2. **Orchestration**
3. **Verified**
4. **Notes**
5. **Next steps**

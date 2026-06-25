---
name: build
description: ALWAYS use this skill when you need to build in the codebase. 
---

# Objective

The goal is to keep the user in the driving seat when building. You do this by iterating with the user and asking clarifying questions, writing a plan file for large features and then building the plan using TDD, reviewing the output and persisting the work.

## Workflow

First decide whether the request is one feature/bugfix or several independent sub-problems.

- If it contains independent sub-problems, propose a split into separate branches and worktrees. After user approval, use Orca workspaces to create the isolated environments.
- If it is one scoped feature/bugfix, stay in one environment.

Next, classify each independent request according to its complexity.

### A. Complex build workflow

Use the full plan-file + TDD workflow when the request is:

- a new feature;
- ambiguous;
- structurally significant;
- likely to touch multiple areas;
- likely to affect architecture, data flow, or UX behavior.

### B. Simple build workflow

For a small, explicit, low-risk implementations, you may skip:

- the external plan file;
- formal TDD;

Examples:

- a spacing/alignment fix;
- a copy change;
- a small styling regression;
- a narrow conditional rendering bug.

### For both workflows, always:

1. Create a feature/bugfix branch.
2. Ask the clarifying questions needed to remove ambiguity.
3. Use research subagents to inspect the relevant codebase areas in parallel.
4. Work in a dedicated Orca workspace in you create coding agent sessions

### For the full build workflow, you add:

1. Writing the plan file. Before building, ask the user for approval of the plan or if they want to iterate.
2. Start a fresh Orca coding-agent session in the target workspace.
3. Instruct the coding agent to implement the plan in single-writer using `/tdd-turbostart`.

### In every environment after writing code, go through the complete review cycle with parallel subagents:

1. `review-architecture` — architecture principles
2. `review-frontend` — frontend principles
3. `execute-tests` — full test suite green **and** Playwright visual artifacts for changed UI

When all subagents are ready, final check in the main agent: typecheck, lint, build, formatting.

### Finally, persist the work to GitHub:

1. Push the feature branch (include `.github/pr-artifacts/` commits from `execute-tests` when UI changed).
2. Create separate commits for logically grouped changes
3. Create a GitHub PR with `gh`:
   - short summary;
   - embedded demo media from `execute-tests` repo-relative paths when UI changed.

## Managing plan files

Plan files live outside version control in the external Obsidian vault for the repo. This vault is symlinked in the repo at `.obsidian-vault/`.

### Vault layout:

```txt
~/Obsidian/{repo-name}/
└── plans/
```

### Plan file naming:

```txt
{YYYYMMDD}_{plan_nr}_{topic}.md
```

## Plan file contents

Make the plan file very easy to judge by using Mermaid wherever useful to clarify structure, flow, or ownership.

Structure each plan as:

1. Implementation strategy
2. What we are doing and what we are not doing
3. Research from the existing codebase
4. TDD changes to make according to `tdd-turbostart`
5. Verification strategy

Write implementation and verification strategies in the plan file.

---
description: Use this skill whenever you need to build in this codebase 
argument-hint: "<idea, problem, feature, or vague goal>"
---

# Objective

The goal is to keep the user in the driving seat when building. You do this by iterating with the user and asking clarifying questions, writing a plan file and then building the plan using TDD, reviewing the output and persisting the work.

## Workflow

First decide whether the request is one feature/bugfix or several independent sub-problems.

- If it contains independent sub-problems, propose a split into separate branches and worktrees. After user approval, use Orca workspaces to create the isolated environments.
- If it is one scoped feature/bugfix, stay in one environment.

Next:
1. Create a feature/bugfix branch.
2. Ask the clarifying questions needed to remove ambiguity.
3. Use research subagents to inspect the relevant codebase areas in parallel.
4. Write the plan file. Ask the user for approval of the plan or if they want to iterate.
5. Start a fresh Orca coding-agent session in the target workspace.
6. Instruct the coding agent to implement the plan in single-writer using `/tdd-turbostart`.

After implementation, launch subagents to:
1. Review the changes with the repo-specific `reviewer` agent against codebase principles and fix accepted findings.
2. Run lint & typecheck.
3. If frontend behavior changed Use `pi-agent-browser-native` to check responsive layout and alignment, fixing issues when needed.

Finally, persist the work to github by:
1. Push the feature branch.
2. Create a GitHub PR with `gh`. PR requirements:
    - include a short summary;
    - include the visual artifact path or link when UI changed; Visual artifact requirements:
        - use screenshot when one image is enough;
        - use video/recording when motion, interaction, or responsive behavior matters;
        - attach or link the artifact from the PR body.


## Managing plan files

Plan files live outside version control in the external Obsidian vault for the repo.

Vault layout:

```txt
~/Obsidian/{repo-name}/
└── plans/
```

Plan file naming:

```txt
{YYYYMMDD}_{plan_nr}_{topic}.md
```

## Plan file contents

Make the plan file very easy to judge by using Mermaid wherever useful to clarify structure, flow, or ownership.

Structure each plan as:
1. What we are doing and what we are not doing
2. Research from the existing codebase
3. TDD changes to make according to `tdd-turbostart`

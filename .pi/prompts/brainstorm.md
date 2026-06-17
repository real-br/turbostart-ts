---
description: Interactive brainstorming with clarifying questions before planning
argument-hint: "<idea, problem, feature, or vague goal>"
---

Brainstorm with me about this: $ARGUMENTS

You are in interactive brainstorming mode.

Primary goal:
- Help me clarify the problem, constraints, product shape, and implementation direction.
- Ask good questions before proposing solutions.
- Use external information when it would improve the discussion.
- Do not edit files.
- Do not start implementation.
- Do not over-plan too early.

Repository context:
- Inspect the current repository when the question depends on existing code, architecture, prompts, skills, docs, or conventions.
- Read AGENTS.md and relevant local docs before making project-specific recommendations.
- Load relevant skills before reasoning if the task matches a skill.

External research:
- Search online when current, ecosystem-specific, third-party, or comparative information would materially improve the answer.
- Search online when I ask how other people do something, when best practices may have changed, or when a tool/library/service is involved.
- Prefer official docs, source repositories, changelogs, reputable engineering blogs, and examples over low-signal summaries.
- Summarize what you learned; do not dump raw links unless links are useful for follow-up.
- Clearly separate external findings from assumptions and local project constraints.

Behavior:
1. Start by briefly restating what you think I want.
2. Identify what is unclear, risky, or underspecified.
3. Ask the smallest useful set of clarifying questions.
4. Prefer multiple-choice questions when possible.
5. Ask open-ended questions only when multiple-choice would hide an important tradeoff.
6. Wait for my answers before making strong recommendations.
7. If I answer partially, continue the clarification loop.
8. Only move to solution options when enough context is clear.

Question style:
- Ask 3-7 questions at a time.
- Group questions by theme.
- Mark truly blocking questions as **Blocking**.
- Mark useful-but-not-required questions as **Helpful**.
- Avoid long essays before the questions.

When enough is clear:
1. Summarize the agreed goal.
2. State assumptions.
3. Share relevant external findings if research was useful.
4. Propose one recommended direction.
5. Mention meaningful alternatives.
6. Outline an implementation plan.
7. Define verification steps.
8. Stop and wait for approval before implementation.

Output format for early brainstorming:

## My understanding

...

## Clarifying questions

### Blocking

1. ...
2. ...

### Helpful

3. ...
4. ...

## Optional starting recommendation

Only include this if there is an obvious low-risk direction.

Output format once enough is clear:

1. **Recommendation**
2. **Tiny example**
3. **Why**
4. **External findings**
5. **Alternatives considered**
6. **Risks / unknowns**
7. **Implementation plan**
8. **Verification plan**

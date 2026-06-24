---
name: tdd-turbostart
description: Test-driven development for a Turbostart codebase. Use when implementing or fixing behavior with Bun, Next.js App Router, tRPC, Drizzle, and Playwright/Vitest, especially when you want a clear RED → GREEN → REFACTOR loop separated from later verification and review.
---

# Turbostart TDD

Use this skill when the task should be built with an explicit test-first loop.

This skill is about **TDD only**:
- choose the right test layer;
- write the failing test first;
- make the smallest change to go green;
- refactor while keeping tests green.

This skill is **not** the final verification/review phase. Repo-principle review, broad validation, browser recordings, and PR evidence happen afterwards unless the user explicitly asks to combine them.

## Core rule

Always separate these two questions:

1. **Did the targeted behavior go green?** → TDD
2. **Is the whole change production-ready and policy-compliant?** → later verification

Do not turn the TDD loop into a full release checklist.

## Choose the smallest correct test layer

### Unit test

Use for:
- pure utilities in `src/lib`
- pure domain helpers
- schema validation helpers
- small transformation/mapping functions
- logic that does not need the database, network, browser, or full request lifecycle

### Integration test

Use for:
- `src/server/{domain}` selectors/services
- tRPC procedures in `src/server/api/routers`
- route handlers in `src/app/api/**`
- auth/data ownership rules
- database behavior
- interactions between multiple modules inside one backend flow

### E2E test

Use for:
- user-facing flows
- navigation, forms, auth flows, dashboard interactions
- browser-visible regressions
- cases where server + client + routing must work together

## Prefer this test selection order

1. **Unit** if the behavior can be proven without framework/runtime setup.
2. **Integration** if the behavior crosses a backend boundary.
3. **E2E** only when the behavior is fundamentally a user flow.

Do not default to E2E when a unit or integration test would prove the behavior faster and more precisely.

## TDD loop

### 1. State the behavior

Before editing, state the smallest behavior to prove.

Examples:
- "reject duplicate invite emails for the same organization"
- "show empty state when no projects exist"
- "prevent unauthenticated access to the billing route"

### 2. Write RED first

Create or update one test that demonstrates the missing behavior.

RED test rules:
- make it fail for one clear reason;
- cover one behavior at a time;
- keep it near the boundary that owns the behavior;
- stop after the first meaningful failure.

### 3. Run the narrowest possible command

Run the smallest command that proves the test is currently failing.

Examples:
- single Vitest file
- single test name filter
- single Playwright spec

Do not run the whole suite unless the task needs that breadth.

### 4. Go GREEN with the smallest change

Implement only enough code to make the failing test pass.

Rules:
- one writer path;
- avoid broad refactors during GREEN;
- do not add unrelated abstractions;
- do not fix neighboring issues unless the failing test requires it.

### 5. Refactor while staying green

Refactor only after the targeted test is green.

Allowed refactor targets:
- make pages/routes thinner;
- restore the selectors/services split;
- split oversized functions;
- move reusable UI to the correct directory.

### 6. Hand off to later verification

After targeted tests are green, stop and hand off to the later verification phase unless the user explicitly asked to continue.

That later phase may include:
- typecheck/lint/build
- broader integration/e2e coverage
- review against AGENTS principles
- screenshots or browser recordings
- PR evidence

## Test file placement and naming

Default to **locality**: keep tests as close as possible to the code that owns the behavior.

### Unit test naming

Use:
- `*.test.ts`
- `*.test.tsx`

Examples:
- `src/lib/cn.test.ts`
- `src/server/billing/types.test.ts`
- `src/features/projects/project-list.test.tsx`
- `src/app/(dashboard)/projects/_components/project-table.test.tsx`

### Integration test naming

Use:
- `*.integration.test.ts`
- `*.integration.test.tsx`

Examples:
- `src/server/billing/services.integration.test.ts`
- `src/server/billing/selectors.integration.test.ts`
- `src/server/api/routers/billing.integration.test.ts`
- `src/app/api/webhooks/clerk.integration.test.ts`

### E2E test naming

Use Playwright-style specs under a dedicated top-level folder:
- `tests/e2e/**/*.spec.ts`

Examples:
- `tests/e2e/auth/sign-in.spec.ts`
- `tests/e2e/billing/checkout.spec.ts`
- `tests/e2e/projects/create-project.spec.ts`

## Placement rules by layer

### Frontend component tests

Keep next to the component they cover.

Examples:
- `src/features/inbox/thread-list.tsx`
- `src/features/inbox/thread-list.test.tsx`

- `src/app/(dashboard)/settings/_components/profile-form.tsx`
- `src/app/(dashboard)/settings/_components/profile-form.test.tsx`

### Server-domain tests

Keep next to the domain file they verify.

Examples:
- `src/server/projects/services.ts`
- `src/server/projects/services.integration.test.ts`

- `src/server/projects/types.ts`
- `src/server/projects/types.test.ts`

### Router tests

Keep next to the router file.

Example:
- `src/server/api/routers/projects.ts`
- `src/server/api/routers/projects.integration.test.ts`

### Route-handler tests

Keep next to the route-local handler/orchestration file when possible.

Examples:
- `src/app/api/import/route.ts`
- `src/app/api/import/route.integration.test.ts`

- `src/app/api/chat/stream.ts`
- `src/app/api/chat/stream.integration.test.ts`

### E2E helpers and fixtures

Use top-level test support folders:
- `tests/e2e/` for Playwright specs
- `tests/fixtures/` for shared static fixtures
- `tests/factories/` for test data builders
- `tests/helpers/` for cross-suite helpers that should not live beside one source file

Keep support files named for what they provide:
- `tests/factories/project-factory.ts`
- `tests/helpers/render-with-providers.tsx`
- `tests/helpers/create-test-trpc-context.ts`

## Naming rules

- Name tests by behavior, not implementation.
- Prefer `describe("createProject")` and `it("rejects duplicate slugs in the same org")` over vague names.
- One source file may have one adjacent test file for unit behavior and one adjacent test file for integration behavior when both are justified.
- Do not create `foo.spec.ts` for Vitest in app/server source trees; reserve `*.spec.ts` for Playwright E2E.
- Do not create a top-level `__tests__` dumping ground unless the existing repo already chose that pattern.

## Suite-selection hints for Turbostart

### `src/lib/*`
Usually unit tests.

### `src/server/{domain}/types.ts`
Usually unit tests.

### `src/server/{domain}/selectors.ts`
Usually integration tests.

### `src/server/{domain}/services.ts`
Usually integration tests.

### `src/server/api/routers/*`
Usually integration tests.

### `src/app/**/_components/*`
Usually component/unit tests; E2E only if behavior matters as part of a real flow.

### `src/app/**/page.tsx`
Prefer E2E or integration at the behavior boundary; keep page tests light because pages should stay thin.

### `src/app/api/**`
Usually integration tests.

## Command policy

Follow the repo's actual scripts if they already exist.

If the repo already defines test scripts, prefer those first.

When no better project-specific script exists, default to narrow commands such as:

```bash
bunx vitest run src/server/projects/services.integration.test.ts
bunx vitest run src/features/projects/project-list.test.tsx
bunx playwright test tests/e2e/projects/create-project.spec.ts
```

During TDD, prefer the narrowest runnable command over `bun run test` across the whole repo.

## Stop rules

Stop the TDD phase and ask or hand off when:
- the right test layer is unclear;
- the failing test reveals missing product requirements;
- a minimal change turns into an architectural decision;
- broad verification is needed beyond the targeted green check;
- frontend evidence/recording is needed.

## Completion shape for this skill

End the TDD phase by reporting:
- targeted behavior;
- test file added or changed;
- RED command;
- GREEN command;
- refactor performed, if any;
- remaining work for the later verification phase.

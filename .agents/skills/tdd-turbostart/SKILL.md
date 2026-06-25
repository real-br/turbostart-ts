---
name: tdd-turbostart
description: Test-driven development for a Turbostart codebase. Use when implementing or fixing behavior with Bun, Next.js App Router, tRPC, Drizzle, and Playwright/Vitest, especially when you want a clear RED → GREEN → REFACTOR loop separated from later verification and review.
---

# Turbostart TDD

TDD only: pick the test layer, write RED first, smallest GREEN change, refactor while green.

Stop before verification/review (typecheck, lint, build, broad suites, AGENTS review, browser recordings, PR evidence) unless the user asks to continue.

**Tools:** Vitest + Testing Library (unit/integration/components), Playwright (e2e). Prefer repo test scripts when defined.

## TDD vs verification

1. Did the targeted behavior go green? → stay in TDD
2. Is the change production-ready? → later verification (handled by `/build`)

## Test layer

Pick the lowest layer that proves the behavior: unit → integration → e2e. Do not use e2e when unit or integration suffices.

| Layer | File pattern | Turbostart targets |
| --- | --- | --- |
| Unit | `*.test.ts(x)` beside source | `src/lib/*`, `src/server/{domain}/types.ts`, pure helpers, transforms, component behavior |
| Integration | `*.integration.test.ts(x)` beside source | `src/server/{domain}/selectors.ts`, `services.ts`, `src/server/api/routers/*`, `src/app/api/**`, auth/ownership, DB |
| E2E | `tests/e2e/**/*.spec.ts` | User flows where server + client + routing must work together |

**Placement:** adjacent to the file under test; mirror source structure. Reserve `*.spec.ts` for Playwright — not Vitest. No top-level `__tests__/` unless the repo already uses it. Split test files when the source module splits.

**Shared helpers** — promote only after real duplication across tests:
- `tests/e2e/` — Playwright specs
- `tests/fixtures/` — static fixtures
- `tests/factories/` — data builders
- `tests/helpers/` — cross-suite helpers (e.g. `render-with-providers.tsx`, `create-test-trpc-context.ts`)

Set assertion-critical values explicitly in the test; do not rely on hidden factory defaults. Integration tests that touch the DB create persisted records deliberately.

## Loop

1. **RED** — one test, one behavior, at the owning boundary. Examples: `describe("createProject")` / `it("rejects duplicate slugs in the same org")`.
2. **Run narrow** — single file, test filter, or spec; not `bun run test` unless the task needs it:

```bash
bunx vitest run src/server/projects/services.integration.test.ts
bunx vitest run src/features/projects/project-list.test.tsx
bunx playwright test tests/e2e/projects/create-project.spec.ts
```

3. **GREEN** — smallest pass only: one writer path, no broad refactors, no unrelated abstractions, no fixing unrelated issues.
4. **REFACTOR** — after green; turbostart targets: thinner pages/routes, selectors/services split, split oversized functions, move reusable UI to `src/features`.
5. **Hand off** — when targeted tests are green.

**Stop and ask** when: test layer is unclear, RED reveals missing product requirements, minimal GREEN needs an architectural decision, or frontend recording is required.

## Report at handoff

- behavior targeted
- test file changed
- RED and GREEN commands
- refactor done (if any)
- remaining verification work

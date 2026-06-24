# Turbostart Agent Guide

You are working in a Turbostart repository: a Next.js product template optimized for shipping products fast with coding agents while keeping the codebase predictable for humans.


## Core Architecture

| Layer | Choice |
| --- | --- |
| App | Next.js App Router + TypeScript |
| API/types | tRPC + React Query + Zod |
| Runtime | Bun |
| Database | Postgres on Neon, production with preview branches per github branch|
| ORM | Drizzle ORM + drizzle-kit migrations |
| Auth | Clerk |
| Frontend | Tailwind CSS + shadcn/ui |
| AI | BAML for structured calls; Vercel AI SDK for agents/streaming |
| Integrations/jobs | Nango + Inngest |
| Observability | PostHog + Sentry |
| Deployment | Vercel GitHub integration, preview deployments per PR |



## Default Project Shape

Use this shape unless the existing repository has already made a more specific local choice. Keep files at the lowest level that is still reusable by more than one call site.

```txt
src/app/                               # App Router entrypoint only: pages, layouts, route handlers
src/app/layout.tsx                     # root HTML/providers shell
src/app/(dashboard)/layout.tsx         # authenticated product shell
src/app/(dashboard)/page.tsx           # dashboard index route
src/app/(dashboard)/{route}/page.tsx   # thin server page for one product route
src/app/(dashboard)/{route}/[id]/page.tsx
src/app/(dashboard)/{route}/_components/{component}.tsx
                                        # route-private UI used only by that route subtree
src/app/(public)/{route}/page.tsx      # public marketing/docs routes when needed
src/app/sign-in/[[...sign-in]]/page.tsx
src/app/sign-up/[[...sign-up]]/page.tsx
src/app/api/trpc/[trpc]/route.ts       # tRPC HTTP adapter
src/app/api/{capability}/route.ts      # non-tRPC route handler: auth, parse, delegate
src/app/api/{capability}/{unit}.ts     # route-handler-local orchestration/tools/prompts

src/components/ui/{primitive}.tsx      # shadcn/ui primitives only
src/components/ai-elements/{part}.tsx  # reusable AI/chat display primitives when needed
src/components/{app-shell-part}.tsx    # cross-route app shell/nav/sidebar components
src/features/{domain}/{component}.tsx  # reusable product UI shared across routes
src/features/{domain}/hooks/{hook}.ts  # client hooks local to one product domain
src/hooks/{hook}.ts                    # generic client hooks, not domain-specific
src/lib/{utility}.ts                   # generic pure utilities, formatting, cn()
src/styles/globals.css                 # global Tailwind/CSS
src/middleware.ts                      # auth/routing middleware
src/env.ts                             # typed env schema
src/load-env.ts                        # env loading helper for scripts when needed

src/trpc/react.tsx                     # client-side tRPC provider/hooks
src/trpc/server.ts                     # server-side tRPC caller
src/trpc/query-client.ts               # React Query client setup

src/server/auth.ts                     # auth/session helpers
src/server/trpc.ts                     # tRPC context/procedure builders
src/server/root.ts                     # app router composition
src/server/api/routers/{domain}.ts     # tRPC procedures; validate input/output and delegate
src/server/db/index.ts                 # Drizzle client and DbClient type
src/server/db/schema.ts                # Drizzle tables/relations
src/server/clients/{service}.ts        # configured external SDK clients
src/server/{domain}/queries.ts         # database reads; may throw domain/tRPC errors
src/server/{domain}/selectors.ts       # database reads; use instead of queries.ts, not both by habit
src/server/{domain}/services.ts        # writes, side effects, workflows
src/server/{domain}/types.ts           # Zod schemas and exported TypeScript types
src/server/{domain}/{unit}.ts          # domain-local prompts, agents, tools, mappers, helpers
src/server/scripts/{script}.ts         # local/dev scripts that need app/server imports

baml_src/{domain}.baml                 # BAML source, grouped by domain/capability
baml_src/clients.baml                  # BAML client/model config
baml_src/generators.baml               # BAML generator config
baml_client/                           # generated BAML client, committed
baml_client/react/                     # generated BAML React helpers, committed when generated
drizzle/{timestamp}_{name}.sql         # generated SQL migrations, committed
drizzle/meta/                          # drizzle-kit migration metadata, committed
public/                                # static assets
data/                                  # local-only stores/fixtures for development when needed
```

Pages stay thin: fetch initial data, compose UI, and pass props. Route handlers stay thin: authenticate, parse/validate request input, then call a server function. Route-private UI can live in `app/**/_components`; reusable product UI moves to `src/features/{domain}`.

Named frontend components live in dedicated files. Use one primary exported component per file; split sibling cards, panels, forms, and reusable sections into separate files instead of collecting them in one large component file. Tiny unexported render helpers may stay local only when they are not independently reusable and do not own layout.

Server domains are the business-logic boundary. Put reads in `queries.ts` or `selectors.ts`, writes/side effects in `services.ts`, and Zod contracts/types in `types.ts`. tRPC routers in `src/server/api/routers` should only define procedures, Zod inputs/outputs, auth level, and calls into the domain layer. External SDK setup belongs in `src/server/clients`; do not instantiate SDK clients inside pages, routers, or random helpers.

## Code Principles

1. **Every function does one thing.** If a function name needs "and" to describe what it does, split it.
2. **No hidden side effects.** If a function modifies state, sends a request, or triggers a side effect, the function name must make that obvious. `get_user()` reads. `create_user()` writes. `get_or_create_user()` might do both — name it clearly.
3. **Readable top-to-bottom.** A reader should understand a file by reading it linearly. No forward references, no "scroll down to understand what this does."
4. **Locality of behaviour.** The behaviour of a unit of code should be as obvious as possible by looking only at that unit of code. It must be traded off against other design principles (DRY & Separation Of Concerns) and be considered in terms of the limitations of the system a code unit is written in, but, as much as is it is practical, adhere to this principle.
5. **Small functions, shallow nesting.** Max 2 levels of indentation inside a function body. If you need more, extract a helper.
6. **Explicit over clever.** No magic. No metaprogramming. No "smart" abstractions that save 3 lines but take 10 minutes to understand. Write the obvious thing.
7. **Name things for what they do, not how they work.** `validate_email()` not `regex_check()`. `fetch_user_profile()` not `make_api_call()`.
7. Filter private data by authenticated Clerk user/org server-side.
8. Commit generated artifacts with their sources: Drizzle migrations and BAML client.
9. Do not add architecture, dependencies, env vars, or services without verification.

## Skill Routing

| Work type | Use |
| --- | --- |
| Known repo gotchas, setup-level changes, Tailwind v4/shadcn/font foundations | `pitfalls` |
| Planning, ambiguity, architecture decisions | `/brainstorm` |
| Normal feature/bug implementation | `/implement` |
| Discovering/installing more skills | `find-skills` |
| Frontend components, shadcn/ui, responsive UI | `design-system` + `shadcn` + `building-components` before editing |
| UI/accessibility/UX review | `web-design-guidelines` |
| React/Next.js code, performance, composition | `next-best-practices` + `vercel-react-best-practices` + `vercel-composition-patterns` |
| Next.js cache/PPR behavior | `next-cache-components` |
| Next.js upgrades | `next-upgrade` |
| Auth, protected routes, Clerk user/org data | `clerk-nextjs-patterns`; setup/API details: `clerk-setup`, `clerk-backend-api` |
| Drizzle schema, migrations, query patterns | `drizzle-orm-patterns` |
| Neon/Postgres setup or claimable databases | `claimable-postgres` |
| tRPC endpoints, selectors/services, Zod contracts | `trpc-endpoint` |
| Test-driven development with Vitest/Playwright | `tdd-turbostart` |
| BAML functions, structured LLM output | `baml-master` |
| Vercel AI SDK agents/chat/RAG | `ai-sdk` |
| AI chat UI components/markdown streaming | `ai-elements` + `streamdown` |
| Durable background work, retries, schedules | `inngest-durable-functions` + `inngest-events` + `inngest-steps` |
| Third-party OAuth/syncs/API integrations | `building-nango-functions`, `building-nango-functions-locally`, `nango-toolbox` |
| Analytics events, identify, funnels | `posthog-instrumentation` |
| Bug/security review | `find-bugs` + `security-review` |
| Deployments and Vercel CLI workflows | `deploy-to-vercel` + `vercel-cli` |
| Parallel workers, worktrees, Orca terminals, Orca browser | Orca CLI / orchestration skills |
| Desktop UI inspection outside browser automation | Computer-use skill |
| Very terse communication | Caveman skill |

If a relevant skill exists, invoke it before making code changes in that domain.

## Workflow Expectations

- Inspect the current code and branch before editing.
- Do not do feature work directly on `main`.
- Keep one branch focused on one feature/bugfix.
- Build the first useful version quickly while preserving the repository file structure and coding principles.
- When making database schema changes during development, immediately run `bun run db:push` against the intended development database.
- Only create the Drizzle migration file once the feature is complete; CI/CD will pick it up during Vercel deployment.
- Verify changes with the smallest relevant checks before reporting completion.
- For UI work, verify in browser and capture screenshots/video when useful.
- For deployment failures, inspect Vercel logs before guessing.
- Do not claim checks passed unless you ran them.

## Testing & TDD Conventions

Treat TDD and later verification as separate phases.

TDD phase:
- choose the smallest valid test layer;
- write RED first;
- make the test go GREEN with the smallest code change;
- refactor only after GREEN.

Later verification phase:
- broader checks;
- repo-principle review;
- browser recordings and PR evidence when needed.

### Test layer selection

Choose in this order unless the behavior forces a wider boundary:
- **Unit**: pure utilities, mappers, schema helpers, isolated component behavior.
- **Integration**: selectors, services, tRPC procedures, route handlers, auth/data ownership, database behavior.
- **E2E**: real user flows across browser + client + server boundaries.

### Test file placement and naming

Keep tests adjacent to the code that owns the behavior.

- **Unit tests**: `*.test.ts` / `*.test.tsx`
- **Integration tests**: `*.integration.test.ts` / `*.integration.test.tsx`
- **E2E tests**: `tests/e2e/**/*.spec.ts`

Examples:

```txt
src/lib/cn.test.ts
src/features/projects/project-list.test.tsx
src/app/(dashboard)/projects/_components/project-table.test.tsx
src/server/projects/types.test.ts
src/server/projects/selectors.integration.test.ts
src/server/projects/services.integration.test.ts
src/server/api/routers/projects.integration.test.ts
src/app/api/webhooks/clerk.integration.test.ts
tests/e2e/projects/create-project.spec.ts
```

Use top-level support folders only for shared test assets:

```txt
tests/helpers/
tests/factories/
tests/fixtures/
```

Rules:
- Reserve `*.spec.ts` for Playwright e2e.
- Prefer adjacent test files over a top-level `__tests__` directory.
- Name tests by behavior.
- A source file may have both `*.test.*` and `*.integration.test.*` only when both layers are needed.
- During TDD, run the narrowest RED or GREEN command instead of the whole suite.

## Environment & Deployment Rules

- Declare env vars in the project env schema and mirror them in `.env.example`.
- Never expose secrets through `NEXT_PUBLIC_*`.
- Keep local, preview, and production envs separate.
- Neon preview branches must not run against production database URLs.
- Drizzle migrations must target the intended database.
- Vercel is the source of truth for preview/prod deployments and logs.

## Common Commands

Use Bun for new template projects. If an existing project has `pnpm-lock.yaml` and `packageManager` set to pnpm, follow that until intentionally migrated.

```bash
bun install
bun run dev
bun run build
bun run lint
bun run typecheck
bun run test
bun run test:watch
bun run test:e2e
bunx playwright install
bun run db:generate
bun run db:migrate
bun run db:push
bun run generate      # BAML client
```
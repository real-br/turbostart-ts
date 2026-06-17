---
name: trpc-endpoint
description: Use when adding or changing tRPC API procedures in a Turbostart app. Guides domain file placement, Zod contracts, auth, selectors/services, and Drizzle access.
argument-hint: "[domain] [procedure-name] [query|mutation]"
---

# tRPC Endpoint Skill

Use this when adding or changing API behavior.

Arguments: `$0` = domain, `$1` = procedure name, `$2` = `query` or `mutation`.

$ARGUMENTS

## Goal

Add a typed tRPC procedure that keeps routing thin, business logic local to the domain, auth explicit, and database access ownership-safe.

## File placement

```txt
src/server/api/routers/$0.ts      # tRPC procedure wiring only
src/server/$0/selectors.ts        # reads only
src/server/$0/services.ts         # writes, jobs, external side effects
src/server/$0/types.ts            # Zod schemas and exported TS types
src/server/$0/utils.ts            # optional pure domain helpers
```

If the domain is new, create the domain folder and router, then register it in `src/server/root.ts`.

## Procedure shape

Queries read. Mutations write or trigger side effects.

```ts
export const projectRouter = createTRPCRouter({
  list: protectedProcedure.query(({ ctx }) =>
    listProjects(ctx.db, ctx.userId),
  ),
  create: protectedProcedure
    .input(createProjectInput)
    .mutation(({ ctx, input }) =>
      createProject(ctx.db, ctx.userId, input),
    ),
});
```

## Rules

- Use `protectedProcedure` by default for product data.
- Use `publicProcedure` only when the route is intentionally public.
- Validate all client input with Zod.
- Derive `userId`, `orgId`, roles, and permissions from Clerk server-side.
- Never trust ownership fields from client input.
- Every private-data selector/service must filter by the authenticated owner.
- Routers should not contain business logic.
- `selectors.ts` must not write.
- `services.ts` names should reveal side effects: `createX`, `updateX`, `syncX`, `enqueueX`.
- Pass `ctx.db` into selectors/services instead of importing the database everywhere.
- Keep return values typed and product-oriented; avoid `any` and ad hoc response blobs.

## Zod contracts

Put shared schemas in `types.ts`.

```ts
import { z } from "zod";

export const createProjectInput = z.object({
  name: z.string().min(1).max(80),
});

export type CreateProjectInput = z.infer<typeof createProjectInput>;
```

## Selector/service examples

```ts
// selectors.ts
export async function listProjects(db: DbClient, userId: string) {
  return db.query.projects.findMany({
    where: eq(projects.userId, userId),
    orderBy: desc(projects.createdAt),
  });
}
```

```ts
// services.ts
export async function createProject(
  db: DbClient,
  userId: string,
  input: CreateProjectInput,
) {
  const [project] = await db
    .insert(projects)
    .values({ userId, name: input.name })
    .returning();

  return project;
}
```

## Verification

Run the smallest relevant project checks for the change:

```bash
bun run typecheck
bun run lint
bun run build
```

If schema changed, also run:

```bash
bun run db:generate
bun run db:migrate
```

> The coding agent setup is a given to allow me to really solve problems I would never be able to do, thats the mindset you need to have for it.

  
++My AI stack++

- Overview ([Agents.md](http://Agents.md))
  - Next.js based on the t3-stack + trpc + clerk for auth
  - When to use what skill
  - CI/CD process
  - Codebase structure 
  - Coding guidelines -&gt; exist as /commands (= .pi/prompts)
  - Self verification
  - Use of environment variables
  - Database migration pitfalls
  - Runtime: bun 
  - Dev Commands

++Workflow prompts / modes++

- /brainstorm
  - Implementation process (hanothi mashumoto x post) 

- /implement
  - parallelization and orchestration -&gt; orca skills
  - Verification setup (typecheck, linting, build, browser/manual verification when useful)
  - Finish work: Github workflow

++Custom skills++

- Stick to the design system (Custom skill + shadcn skill -&gt; coding guidelines?)
  - Ask for the design system to be bootstrapped from the shadcn interface 
  - Responsive design
  - Reusable design foundations:
    - think in sections, blocks, etc to name gaps, typography etc tailwind elements. keep it minimal in the beginning and avoid custom foundations if only used in a single footer,... semantics are extremely important to name things the correct way
  - keep track of the component tree

- 

++Third party skills++

- Authentication (Clerk skill)
- Agent features (Vercel AI SDK)
- Structured Output AI features (BAML)
- Background tasks (Inngest skill)
- Frontend components (shadcn skill) 
- Github commits &amp; PR descriptions (Orca? Cursor?)
  - Screenshots and videos
- Browser/manual verification:
  - Computer use &amp; screenshots?
- Deployment &amp; verification (vercel skill + agents.md)
  - Think about how this would work in the git process -&gt; webhook if deployment fails + vercel skill based debugging?
- Observability
  - Posthog skill
  - Sentry skill
- Environment variables (Agents.md to highlight pitfalls when running migrations local vs cicd)
  - Database and migrations
- ORM and query writing: (drizzle orm skill)
- Data integrations: Nango I know and love
- Caveman



++Needed functionalities when working in my stack++

1. When initializing a new project:
  1. Copy paste [Agents.md](http://Agents.md) at repo root level, all custom skills at .pi/skills/ and work prompts at .pi/prompts from this template repo -&gt; CLI command
  2. Fetch the up-to-date versions of the 3th party skills into .pi/skills -&gt; can also be marketplace extensions (e.g. vercel) -&gt; Bash script -&gt; need to think how it works with the interactive UI when installing skills or add the correct cli installation flags.
  3. Execute the create-t3-app command -&gt; manually 



++How we're building this++

1. Write the [Agents.md](http://Agents.md) file
2. Write the custom prompts
3. Write the custom skills
4. Package it up
5. Create a very simple CLI to initialize a new project
6. Bash script that installs third party skills one by one
7. 



++Optional niceties++

1. Readme
2. Versioning
3. Landing page
4. 



++Potential future expansions++

- Testing after v1 stabilizes:
  - Add a dedicated testing/TDD skill later, not as part of the initial Turbostart default workflow
  - Possible stack: Vitest, React Testing Library, MSW, Playwright, BAML tests, Testcontainers Postgres
  - Use tests once product shape and core flows are clearer


 



&nbsp;
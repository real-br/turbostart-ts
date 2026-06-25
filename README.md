# turbostart-ts

Bootstrap a Turbostart project with the repo agent guide, custom skills, a deterministic create-t3 scaffold, and a final Pi refinement prompt.

## Usage

Install from the GitHub repository with Bun:

```bash
bun install -g github:real-br/turbostart-ts
turbostart-ts my-app
```

Or install the packaged release tarball:

```bash
bun install -g https://github.com/real-br/turbostart-ts/releases/download/v1.0.0/turbostart-ts-1.0.0.tgz
turbostart-ts my-app
```

For local development:

```bash
bun install
bun run start my-app
```

## Flow

1. Creates the project folder.
2. Creates an external Obsidian vault at `~/Obsidian/<project-name>/plans` for build plan files, then symlinks that vault into the repository as `.obsidian-vault`.
3. Runs a non-interactive `create-t3-app` scaffold with these fixed choices: App Router, Tailwind, tRPC, Drizzle, Postgres, ESLint, alias `@/*`, and no built-in auth.
4. Normalizes the raw T3 output into the Turbostart file shape with command-driven moves and renames.
5. Installs and configures the opinionated testing stack: Vitest, Testing Library, and Playwright.
6. Initializes shadcn with the `base` component library.
7. Applies deterministic polish to generated files, including the app README, metadata, and Tailwind font token fixes.
8. Copies `AGENTS.md`, the review agent files in `.pi/agents/` (`review-architecture`, `review-frontend`, `execute-tests`), design-system docs, custom skills (`baml-master`, `build`, `design-system`, `tdd-turbostart`, `trpc-endpoint`), and a temporary `scripts/install-agent-skills.sh`.
9. Optionally runs the online third-party skill installer, then removes the temporary installer script.
10. If the scaffold generated `start-database.sh`, optionally starts and verifies local Postgres before the Pi handoff, then runs `db:push`. If `localhost:5432` is already in use, Turbostart picks the next free port and updates `.env`.
11. Adds `.agents/skills/`, `.obsidian-vault`, `playwright-report/`, and `test-results/` to the generated app's `.gitignore`.
12. Initializes a local git repository if needed, creates the initial commit, publishes the project to a private GitHub repository with `gh`, and pushes all files.
13. Launches Pi with a narrower refinement prompt to transform the remaining raw create-t3 UI into the Turbostart + shadcn shape.

## Options

```bash
turbostart-ts [project-folder] [options]

--runner <bun|pnpm|npm|yarn>  Runner used for the base scaffold
-y, --yes                     Accept default confirmations
--skip-skills                 Skip online skill installation
--skip-scaffold               Skip the deterministic base scaffold
--skip-db                     Skip local Postgres setup after scaffolding
--skip-pi                     Skip final Pi refinement prompt
```

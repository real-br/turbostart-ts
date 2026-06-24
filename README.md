# turbostart-ts

Bootstrap a Turbostart project with the repo agent guide, custom skills, a third-party skill installer, an interactive base scaffold handoff, and a final Pi preparation prompt.

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
2. Creates an external Obsidian vault at `~/Obsidian/<project-name>/plans` for build plan files.
3. Copies `AGENTS.md`, `.pi/agents/reviewer.md`, design-system docs, custom skills (`baml-master`, `build`, `design-system`, `pitfalls`, `tdd-turbostart`, `trpc-endpoint`), and a temporary `scripts/install-agent-skills.sh`.
4. Optionally runs the online third-party skill installer, then removes the temporary installer script.
5. Optionally starts the base scaffold in the new folder so the user can complete its prompts manually.
6. If the scaffold generated `start-database.sh`, optionally starts and verifies local Postgres before the Pi handoff, then runs `db:push`. If `localhost:5432` is already in use, Turbostart picks the next free port and updates `.env`.
7. Adds `.agents/skills/` to the generated app's `.gitignore`.
8. Launches Pi with a preparation prompt that includes shadcn migration plus default Vitest, Testing Library, and Playwright setup.

## Options

```bash
turbostart-ts [project-folder] [options]

--runner <bun|pnpm|npm|yarn>  Runner used for the base scaffold
--skip-skills                 Skip online skill installation
--skip-scaffold               Skip base scaffold handoff
--skip-db                     Skip local Postgres setup after scaffolding
--skip-pi                     Skip final Pi preparation prompt
```

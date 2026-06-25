#!/usr/bin/env node
import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  outro,
  select,
  spinner,
  text,
} from "@clack/prompts";
import { Command } from "commander";
import { execa } from "execa";
import pc from "picocolors";
import { randomBytes } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import net from "node:net";
import {
  access,
  chmod,
  cp,
  lstat,
  mkdir,
  readFile,
  readlink,
  readdir,
  rename,
  rm,
  rmdir,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cliRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const cwd = process.cwd();

const customSkillNames = [
  "baml-master",
  "build",
  "design-system",
  "tdd-turbostart",
  "trpc-endpoint",
];
const repoVaultSymlinkName = ".obsidian-vault";
const agentGitignoreEntries = [
  ".agents/skills/",
  repoVaultSymlinkName,
  "playwright-report/",
  "test-results/",
];
const repoPreparationPrompt =
  "Transform the scaffolded create-t3 output into the Turbostart structure, replace the remaining raw create-t3 UI with shadcn-based code, and finish the template polish.";
const createT3Choices = {
  appRouter: true,
  betterAuth: false,
  biome: false,
  dbProvider: "postgres",
  drizzle: true,
  eslint: true,
  importAlias: "@/*",
  nextAuth: false,
  prisma: false,
  tailwind: true,
  trpc: true,
};
const opinionatedTestPackages = [
  "vitest",
  "jsdom",
  "@vitest/coverage-v8",
  "@testing-library/react",
  "@testing-library/jest-dom",
  "@testing-library/user-event",
  "@playwright/test",
  "vite-tsconfig-paths",
];
const assetCopies = [
  { from: "AGENTS.md", to: "AGENTS.md", label: "agent guide" },
  {
    from: "docs/design-system",
    to: "docs/design-system",
    label: "design-system docs",
  },
  {
    from: "scripts/install-agent-skills.sh",
    to: "scripts/install-agent-skills.sh",
    label: "skill installer",
  },
  {
    from: ".pi/agents/review-architecture.md",
    to: ".pi/agents/review-architecture.md",
    label: "architecture review agent",
  },
  {
    from: ".pi/agents/review-frontend.md",
    to: ".pi/agents/review-frontend.md",
    label: "frontend review agent",
  },
  {
    from: ".pi/agents/execute-tests.md",
    to: ".pi/agents/execute-tests.md",
    label: "test execution agent",
  },
  ...customSkillNames.map((skillName) => ({
    from: `.agents/skills/${skillName}`,
    to: `.agents/skills/${skillName}`,
    label: `${skillName} skill`,
  })),
];

const runnerCommands = {
  bun: "bunx",
  pnpm: "pnpm",
  npm: "npm",
  yarn: "yarn",
};

main().catch((error) => {
  cancel(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main() {
  const options = parseArgs(process.argv.slice(2));

  intro(pc.bold(pc.cyan("Turbostart bootstrap")));

  const projectInput = await getProjectInput(options.projectName);
  const projectPath = path.resolve(cwd, projectInput);
  const projectName = path.basename(projectPath);

  log.info(`Project folder: ${projectPath}`);

  await prepareProjectFolder(projectPath);
  const planVaultPath = await ensurePlanVault(projectName, projectPath);
  log.info(`Plan vault: ${planVaultPath}`);

  const shouldRunScaffold = !options.skipScaffold;

  if (shouldRunScaffold) {
    const runner = await getRunner(options.runner);
    await runBaseScaffold(projectPath, runner);
    await finalizeScaffold(projectPath, runner);

    if (!options.skipDb) {
      await ensureLocalDatabase(projectPath, runner);
    }
  } else {
    log.warn(`Skipped base scaffold. Run it later from ${projectName}.`);
  }

  await copyTemplateAssets(projectPath);

  const shouldInstallSkills = options.skipSkills
    ? false
    : await confirmStep(
        "Install third-party skills from online sources now?",
        true,
        options.yes,
      );

  if (shouldInstallSkills) {
    await installAgentSkills(projectPath);
    await removeSkillInstaller(projectPath);
  } else {
    log.warn(
      "Skipped third-party skill install. Run scripts/install-agent-skills.sh inside the project later.",
    );
  }

  await ensureAgentResourcesIgnored(projectPath);

  if (shouldRunScaffold && !options.skipPi) {
    await launchPiPreparationPrompt(projectPath);
  } else if (options.skipPi) {
    log.warn(
      `Skipped pi handoff. Run ${pc.bold(formatCommand("pi", ["--approve", repoPreparationPrompt]))} inside ${projectName} later.`,
    );
  }

  await ensureGitRepository(projectPath);
  await publishProjectRepository(projectPath, projectName);

  outro(`Ready: cd ${path.relative(cwd, projectPath) || "."}`);
}

function parseArgs(args) {
  const program = new Command();

  program
    .name("turbostart-ts")
    .description(
      "Bootstrap a Turbostart project with agent instructions, skills, and a deterministic create-t3 scaffold.",
    )
    .argument("[project-folder]", "folder to create for the new project")
    .option(
      "--runner <runner>",
      "package runner for the base scaffold: bun, pnpm, npm, or yarn",
    )
    .option(
      "--skip-skills",
      "copy local assets but skip online skill installation",
      false,
    )
    .option("-y, --yes", "accept default confirmations", false)
    .option("--skip-scaffold", "skip the deterministic base scaffold", false)
    .option("--skip-db", "skip local Postgres setup after scaffolding", false)
    .option(
      "--skip-pi",
      "skip the final pi refinement prompt after scaffolding",
      false,
    )
    .addHelpText(
      "after",
      `\n${pc.bold("Examples:")}\n  ${pc.dim("$")} turbostart-ts my-app\n  ${pc.dim("$")} turbostart-ts my-app --runner bun --skip-skills\n  ${pc.dim("$")} turbostart-ts my-app --skip-db`,
    )
    .parse(args, { from: "user" });

  const selectedRunner = program.opts().runner;
  if (selectedRunner && !runnerCommands[selectedRunner]) {
    throw new Error(`Unsupported runner: ${selectedRunner}`);
  }

  return {
    projectName: program.args[0],
    runner: selectedRunner,
    skipSkills: program.opts().skipSkills,
    skipScaffold: program.opts().skipScaffold,
    skipDb: program.opts().skipDb,
    skipPi: program.opts().skipPi,
    yes: program.opts().yes,
  };
}

async function getProjectInput(projectName) {
  if (projectName) {
    const error = validateProjectInput(projectName);
    if (error) {
      throw new Error(error);
    }

    return projectName;
  }

  const value = await text({
    message: "Where should the new project be created?",
    placeholder: "my-app",
    validate: (input) => validateProjectInput(input),
  });

  stopIfCanceled(value);
  return value;
}

function validateProjectInput(input) {
  if (!input || input.trim().length === 0) {
    return "Enter a project folder.";
  }

  if (input.includes("\0")) {
    return "Project folder contains an invalid character.";
  }

  return undefined;
}

async function prepareProjectFolder(projectPath) {
  const s = spinner();
  s.start("Creating project folder");

  const exists = await pathExists(projectPath);
  if (!exists) {
    await mkdir(projectPath, { recursive: true });
    s.stop("Created project folder");
    return;
  }

  const entryStat = await stat(projectPath);
  if (!entryStat.isDirectory()) {
    s.stop("Project folder unavailable");
    throw new Error(`${projectPath} exists and is not a directory.`);
  }

  const entries = await readdir(projectPath);
  if (entries.length === 0) {
    s.stop("Using empty project folder");
    return;
  }

  s.stop("Project folder already exists");
  const proceed = await confirmStep(
    "Folder is not empty. Continue and merge Turbostart assets?",
    false,
  );
  if (!proceed) {
    throw new Error("Bootstrap canceled because the folder is not empty.");
  }
}

async function ensurePlanVault(projectName, projectPath) {
  const vaultPath = path.join(homedir(), "Obsidian", projectName);
  const plansPath = path.join(vaultPath, "plans");
  const repoVaultPath = path.join(projectPath, repoVaultSymlinkName);
  const s = spinner();
  s.start("Creating external Obsidian plan vault");
  await mkdir(plansPath, { recursive: true });
  s.stop("Created external Obsidian plan vault");

  await ensureRepoVaultSymlink(repoVaultPath, vaultPath);
  return repoVaultPath;
}

async function ensureRepoVaultSymlink(repoVaultPath, vaultPath) {
  const s = spinner();
  s.start(`Linking Obsidian vault into ${path.basename(repoVaultPath)}`);

  try {
    const existingEntry = await lstat(repoVaultPath);

    if (!existingEntry.isSymbolicLink()) {
      s.stop("Obsidian vault link unavailable");
      throw new Error(
        `${repoVaultPath} already exists and is not the expected symlink to ${vaultPath}.`,
      );
    }

    const currentTarget = await readlink(repoVaultPath);
    const resolvedTarget = path.resolve(
      path.dirname(repoVaultPath),
      currentTarget,
    );

    if (resolvedTarget !== vaultPath) {
      s.stop("Obsidian vault link unavailable");
      throw new Error(
        `${repoVaultPath} already points to ${resolvedTarget}. Expected ${vaultPath}.`,
      );
    }

    s.stop("Using existing Obsidian vault symlink");
    return;
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }

  await symlink(vaultPath, repoVaultPath, "dir");
  s.stop(`Linked Obsidian vault into ${path.basename(repoVaultPath)}`);
}

async function copyTemplateAssets(projectPath) {
  const s = spinner();
  s.start(
    "Copying agent guide, installer, custom skills, and reviewer override",
  );

  for (const asset of assetCopies) {
    await copyAsset(asset, projectPath);
  }

  await chmod(path.join(projectPath, "scripts/install-agent-skills.sh"), 0o755);
  s.stop("Copied Turbostart agent assets");
}

async function copyAsset(asset, projectPath) {
  const source = path.join(cliRoot, asset.from);
  const target = path.join(projectPath, asset.to);

  if (!(await pathExists(source))) {
    throw new Error(`Missing ${asset.label}: ${source}`);
  }

  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target, {
    recursive: true,
    force: true,
    errorOnExist: false,
  });
}

async function installAgentSkills(projectPath) {
  await ensureCommand(
    "bun",
    "Bun is required because scripts/install-agent-skills.sh uses bunx.",
  );
  log.step("Installing third-party skills. This can take a few minutes.");
  await runCommand("bash", ["scripts/install-agent-skills.sh"], projectPath);
  log.success("Installed third-party skills");
}

async function removeSkillInstaller(projectPath) {
  const installerPath = path.join(
    projectPath,
    "scripts/install-agent-skills.sh",
  );
  await rm(installerPath, { force: true });
  await removeScriptsDirectoryIfEmpty(projectPath);
  log.success("Removed temporary skill installer script");
}

async function removeScriptsDirectoryIfEmpty(projectPath) {
  const scriptsPath = path.join(projectPath, "scripts");

  try {
    const entries = await readdir(scriptsPath);
    if (entries.length === 0) {
      await rmdir(scriptsPath);
    }
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }

    throw error;
  }
}

async function ensureAgentResourcesIgnored(projectPath) {
  const gitignorePath = path.join(projectPath, ".gitignore");
  const currentGitignore = await readTextFileIfPresent(gitignorePath);
  const missingEntries = agentGitignoreEntries.filter(
    (entry) => !gitignoreHasEntry(currentGitignore, entry),
  );

  if (missingEntries.length === 0) {
    return;
  }

  const separator =
    currentGitignore.length === 0 || currentGitignore.endsWith("\n")
      ? ""
      : "\n";
  const block = `${separator}\n# Turbostart agent resources\n${missingEntries.join("\n")}\n`;
  await writeFile(gitignorePath, `${currentGitignore}${block}`);
  log.success("Gitignored agent resources and test artifacts");
}

async function ensureGitRepository(projectPath) {
  await ensureCommand(
    "git",
    "Git is required to initialize the project repository.",
  );

  if (await pathExists(path.join(projectPath, ".git"))) {
    log.success("Using existing git repository");
    return;
  }

  const s = spinner();
  s.start("Initializing git repository");

  try {
    await runCommand("git", ["init", "-b", "main"], projectPath);
    s.stop("Initialized git repository");
  } catch (error) {
    s.stop("Git repository initialization failed");
    throw error;
  }
}

async function publishProjectRepository(projectPath, projectName) {
  await ensureCommand(
    "gh",
    "GitHub CLI is required to publish the scaffolded repository automatically.",
  );

  await ensureGitCommitIdentity(projectPath);
  await commitProjectFiles(projectPath);

  const originUrl = await getGitRemoteUrl(projectPath, "origin");
  if (originUrl) {
    await pushGitBranch(projectPath, originUrl);
    return;
  }

  const s = spinner();
  s.start("Creating GitHub repository and pushing initial commit");

  try {
    await runCommand(
      "gh",
      [
        "repo",
        "create",
        projectName,
        "--private",
        "--source=.",
        "--remote=origin",
        "--push",
      ],
      projectPath,
    );
    s.stop("Published GitHub repository and pushed initial commit");
  } catch (error) {
    s.stop("GitHub publish failed");
    throw error;
  }
}

async function ensureGitCommitIdentity(projectPath) {
  const currentName = await getGitConfigValue(projectPath, "user.name");
  const currentEmail = await getGitConfigValue(projectPath, "user.email");

  if (currentName && currentEmail) {
    return;
  }

  const githubLogin = await runCommandOutput(
    "gh",
    ["api", "user", "-q", ".login"],
    projectPath,
  );
  const nextName = currentName || githubLogin;
  const nextEmail = currentEmail || `${githubLogin}@users.noreply.github.com`;

  if (!currentName) {
    await runCommand("git", ["config", "user.name", nextName], projectPath);
  }

  if (!currentEmail) {
    await runCommand("git", ["config", "user.email", nextEmail], projectPath);
  }
}

async function commitProjectFiles(projectPath) {
  const s = spinner();
  s.start("Committing scaffolded files");

  try {
    await runCommand("git", ["add", "-A"], projectPath);

    const status = await runCommandOutput(
      "git",
      ["status", "--short"],
      projectPath,
    );
    if (status.length === 0) {
      s.stop("Git working tree already clean");
      return;
    }

    await runCommand("git", ["commit", "-m", "Initial commit"], projectPath);
    s.stop("Committed scaffolded files");
  } catch (error) {
    s.stop("Git commit failed");
    throw error;
  }
}

async function pushGitBranch(projectPath, originUrl) {
  const branchName = await getCurrentGitBranch(projectPath);
  const s = spinner();
  s.start(`Pushing ${branchName} to ${originUrl}`);

  try {
    await runCommand("git", ["push", "-u", "origin", branchName], projectPath);
    s.stop(`Pushed ${branchName} to ${originUrl}`);
  } catch (error) {
    s.stop("Git push failed");
    throw error;
  }
}

async function getGitRemoteUrl(projectPath, remoteName) {
  try {
    return await runCommandOutput(
      "git",
      ["remote", "get-url", remoteName],
      projectPath,
    );
  } catch {
    return "";
  }
}

async function getCurrentGitBranch(projectPath) {
  const branchName = await runCommandOutput(
    "git",
    ["rev-parse", "--abbrev-ref", "HEAD"],
    projectPath,
  );

  if (branchName === "HEAD") {
    return "main";
  }

  return branchName;
}

async function getGitConfigValue(projectPath, key) {
  try {
    return await runCommandOutput("git", ["config", "--get", key], projectPath);
  } catch {
    return "";
  }
}

async function launchPiPreparationPrompt(projectPath) {
  try {
    await ensureCommand(
      "pi",
      "Pi is required to run the final repository preparation prompt.",
    );
  } catch {
    log.warn(
      "Pi was not found, so the final repository preparation prompt could not be launched.",
    );
    log.info(
      `Run it manually inside the project: ${pc.bold(formatCommand("pi", ["--approve", repoPreparationPrompt]))}`,
    );
    return;
  }

  log.step(
    `Launching pi: ${pc.bold(formatCommand("pi", ["--approve", repoPreparationPrompt]))}`,
  );
  await runCommand("pi", ["--approve", repoPreparationPrompt], projectPath);
  log.success("Pi refinement prompt finished");
}

async function getRunner(runner) {
  if (runner) {
    if (!runnerCommands[runner]) {
      throw new Error(`Unsupported runner: ${runner}`);
    }

    return runner;
  }

  const value = await select({
    message: "Which runner should launch the base scaffold?",
    initialValue: "bun",
    options: [
      { value: "bun", label: "Bun", hint: "recommended" },
      { value: "pnpm", label: "pnpm" },
      { value: "npm", label: "npm" },
      { value: "yarn", label: "Yarn" },
    ],
  });

  stopIfCanceled(value);
  return value;
}

async function runBaseScaffold(projectPath, runner) {
  const command = runnerCommands[runner];
  const args = getScaffoldArgs(runner);
  await ensureCommand(
    command,
    `${command} is required to run the base scaffold with this runner.`,
  );

  log.step(
    `Running deterministic create-t3 scaffold: ${pc.bold(`${command} ${args.join(" ")}`)}`,
  );
  try {
    await runCommand(command, args, projectPath);
  } catch (error) {
    if (!(await pathExists(path.join(projectPath, "package.json")))) {
      throw error;
    }

    log.warn(
      "create-t3 exited with an install-related error after writing files. Continuing with a manual dependency install.",
    );
  }

  await installProjectDependencies(projectPath, runner);
  log.success("Base scaffold finished");
}

function getScaffoldArgs(runner) {
  const baseArgs =
    runner === "bun"
      ? ["create-t3-app@latest", "."]
      : runner === "yarn"
        ? ["create", "t3-app", "."]
        : ["create", "t3-app@latest", "."];

  return [
    ...baseArgs,
    "--CI",
    "--noInstall",
    "--appRouter",
    String(createT3Choices.appRouter),
    "--tailwind",
    String(createT3Choices.tailwind),
    "--trpc",
    String(createT3Choices.trpc),
    "--drizzle",
    String(createT3Choices.drizzle),
    "--dbProvider",
    createT3Choices.dbProvider,
    "--eslint",
    String(createT3Choices.eslint),
    "--nextAuth",
    String(createT3Choices.nextAuth),
    "--betterAuth",
    String(createT3Choices.betterAuth),
    "--prisma",
    String(createT3Choices.prisma),
    "--biome",
    String(createT3Choices.biome),
    "--import-alias",
    createT3Choices.importAlias,
  ];
}

async function finalizeScaffold(projectPath, runner) {
  await normalizeT3Structure(projectPath);
  await setupOpinionatedTesting(projectPath, runner);
  await initializeShadcn(projectPath);
  await polishScaffoldedFiles(projectPath);
}

async function normalizeT3Structure(projectPath) {
  const s = spinner();
  s.start("Normalizing scaffolded file structure");

  try {
    await moveFileIfPresent(
      projectPath,
      "src/app/page.tsx",
      "src/app/(public)/page.tsx",
    );
    await moveFileIfPresent(
      projectPath,
      "src/app/_components/post.tsx",
      "src/app/(public)/_components/post.tsx",
    );
    await moveFileIfPresent(
      projectPath,
      "src/server/api/root.ts",
      "src/server/root.ts",
    );
    await moveFileIfPresent(
      projectPath,
      "src/server/api/trpc.ts",
      "src/server/trpc.ts",
    );
    await moveFileIfPresent(projectPath, "src/env.js", "src/env.ts");

    await replaceInFileIfPresent(projectPath, "src/app/(public)/page.tsx", [
      ["~/app/_components/post", "~/app/(public)/_components/post"],
    ]);
    await replaceInFileIfPresent(
      projectPath,
      "src/app/api/trpc/[trpc]/route.ts",
      [
        ["~/server/api/root", "~/server/root"],
        ["~/server/api/trpc", "~/server/trpc"],
      ],
    );
    await replaceInFileIfPresent(projectPath, "src/trpc/react.tsx", [
      ["~/server/api/root", "~/server/root"],
    ]);
    await replaceInFileIfPresent(projectPath, "src/trpc/server.ts", [
      ["~/server/api/root", "~/server/root"],
      ["~/server/api/trpc", "~/server/trpc"],
    ]);
    await replaceInFileIfPresent(
      projectPath,
      "src/server/api/routers/post.ts",
      [["~/server/api/trpc", "~/server/trpc"]],
    );
    await replaceInFileIfPresent(projectPath, "src/server/root.ts", [
      ["~/server/api/trpc", "~/server/trpc"],
    ]);

    await removeDirectoryIfEmpty(path.join(projectPath, "src/app/_components"));
    s.stop("Normalized scaffolded file structure");
  } catch (error) {
    s.stop("File structure normalization failed");
    throw error;
  }
}

async function setupOpinionatedTesting(projectPath, runner) {
  const s = spinner();
  s.start("Installing Vitest, Testing Library, and Playwright");

  try {
    await addDevDependencies(projectPath, runner, opinionatedTestPackages);
    await updatePackageJson(projectPath, (packageJson) => {
      packageJson.scripts = {
        ...packageJson.scripts,
        test: "vitest run",
        "test:watch": "vitest",
        "test:e2e": "playwright test",
        "test:e2e:ui": "playwright test --ui",
      };
      return packageJson;
    });

    await mkdir(path.join(projectPath, "tests/setup"), { recursive: true });
    await mkdir(path.join(projectPath, "tests/e2e"), { recursive: true });
    await mkdir(path.join(projectPath, ".github/pr-artifacts"), {
      recursive: true,
    });

    await writeFile(
      path.join(projectPath, "vitest.config.ts"),
      getVitestConfig(),
    );
    await writeFile(
      path.join(projectPath, "playwright.config.ts"),
      getPlaywrightConfig(),
    );
    await writeFile(
      path.join(projectPath, "tests/setup/vitest.setup.ts"),
      'import "@testing-library/jest-dom/vitest";\n',
    );
    await writeFile(path.join(projectPath, "tests/e2e/.gitkeep"), "");
    await writeFile(
      path.join(projectPath, ".github/pr-artifacts/.gitkeep"),
      "",
    );

    await installPlaywrightBrowser(projectPath);
    s.stop("Configured opinionated testing stack");
  } catch (error) {
    s.stop("Testing setup failed");
    throw error;
  }
}

async function initializeShadcn(projectPath) {
  const s = spinner();
  s.start("Initializing shadcn with the base preset");

  try {
    await ensureCommand("npx", "npx is required to initialize shadcn/ui.");
    await runCommand(
      "npx",
      [
        "shadcn@latest",
        "init",
        "-t",
        "next",
        "-b",
        "base",
        "-y",
        "--defaults",
        "--css-variables",
        "--no-monorepo",
        "--cwd",
        projectPath,
      ],
      projectPath,
    );
    s.stop("Initialized shadcn");
  } catch (error) {
    s.stop("shadcn initialization failed");
    throw error;
  }
}

async function polishScaffoldedFiles(projectPath) {
  const s = spinner();
  s.start("Polishing deterministic scaffold files");

  try {
    const projectName = path.basename(projectPath);
    await rewriteFileIfPresent(projectPath, "src/app/layout.tsx", (content) =>
      content
        .replace(
          'title: "Create T3 App"',
          `title: "${formatProjectTitle(projectName)}"`,
        )
        .replace(
          'description: "Generated by create-t3-app"',
          'description: "Built with the Turbostart TypeScript template."',
        )
        .replace(
          "      <body>\n",
          '      <body className="min-h-screen font-sans antialiased">\n',
        ),
    );

    await rewriteFileIfPresent(
      projectPath,
      "src/styles/globals.css",
      (content) =>
        content.replace(
          "  --font-heading: var(--font-sans);\n  --font-sans: var(--font-sans);",
          "  --font-heading: var(--font-geist-sans);\n  --font-sans: var(--font-geist-sans);",
        ),
    );

    await writeFile(
      path.join(projectPath, "README.md"),
      getProjectReadme(projectName),
    );

    s.stop("Polished deterministic scaffold files");
  } catch (error) {
    s.stop("Scaffold file polish failed");
    throw error;
  }
}

async function ensureLocalDatabase(projectPath, runner) {
  const startDatabasePath = path.join(projectPath, "start-database.sh");
  const envPath = path.join(projectPath, ".env");

  if (!(await pathExists(startDatabasePath))) {
    return;
  }

  if (!(await pathExists(envPath))) {
    log.warn(
      "Found start-database.sh, but .env is missing. Skipping local Postgres setup.",
    );
    return;
  }

  const shouldStartDatabase = await confirmStep(
    "Start and verify local Postgres before the Pi handoff?",
    true,
    false,
  );
  if (!shouldStartDatabase) {
    log.warn("Skipped local Postgres setup.");
    return;
  }

  await startLocalDatabase(envPath);
  await pushDatabaseSchema(projectPath, runner);
}

async function startLocalDatabase(envPath) {
  const s = spinner();
  s.start("Preparing local Postgres");

  try {
    const envContent = await readFile(envPath, "utf8");
    const databaseUrl = readDatabaseUrl(envContent);
    if (!databaseUrl) {
      s.stop("Local Postgres skipped");
      log.warn("DATABASE_URL is missing from .env.");
      return;
    }

    const dbConfig = parseLocalDatabaseUrl(databaseUrl);
    if (!dbConfig) {
      s.stop("Local Postgres skipped");
      log.warn("DATABASE_URL is not a localhost Postgres URL.");
      return;
    }

    const runtime = await getContainerRuntime();
    const containerState = await getContainerState(
      runtime,
      dbConfig.containerName,
    );

    if (containerState === "running") {
      const mappedPort = await getMappedPostgresPort(
        runtime,
        dbConfig.containerName,
      );
      if (mappedPort && mappedPort !== dbConfig.port) {
        await writeDatabaseUrl(envPath, dbConfig, { port: mappedPort });
      }

      await waitForDatabase(
        runtime,
        dbConfig.containerName,
        dbConfig.username,
        dbConfig.database,
      );
      s.stop(`Local Postgres already running in '${dbConfig.containerName}'`);
      return;
    }

    if (containerState === "stopped") {
      await startExistingDatabaseContainer(runtime, dbConfig.containerName);
      const mappedPort = await getMappedPostgresPort(
        runtime,
        dbConfig.containerName,
      );
      if (mappedPort && mappedPort !== dbConfig.port) {
        await writeDatabaseUrl(envPath, dbConfig, { port: mappedPort });
      }

      await waitForDatabase(
        runtime,
        dbConfig.containerName,
        dbConfig.username,
        dbConfig.database,
      );
      s.stop(
        `Started existing local Postgres container '${dbConfig.containerName}'`,
      );
      return;
    }

    const port = await findAvailablePort(dbConfig.port);
    const password =
      dbConfig.password === "password"
        ? generateDatabasePassword()
        : dbConfig.password;

    if (port !== dbConfig.port || password !== dbConfig.password) {
      await writeDatabaseUrl(envPath, dbConfig, { password, port });
    }

    await createDatabaseContainer(runtime, {
      ...dbConfig,
      password,
      port,
    });
    await waitForDatabase(
      runtime,
      dbConfig.containerName,
      dbConfig.username,
      dbConfig.database,
    );

    const portMessage = port === dbConfig.port ? "" : ` on port ${port}`;
    s.stop(
      `Created local Postgres container '${dbConfig.containerName}'${portMessage}`,
    );
  } catch (error) {
    s.stop("Local Postgres setup failed");
    throw error;
  }
}

async function pushDatabaseSchema(projectPath, runner) {
  if (!(await packageScriptExists(projectPath, "db:push"))) {
    log.warn("Skipped db:push because package.json has no db:push script.");
    return;
  }

  log.step(`Running ${runner} run db:push`);

  try {
    await runCommand(runner, ["run", "db:push"], projectPath);
    log.success("Database schema pushed");
  } catch {
    throw new Error(
      `Local Postgres is running, but '${runner} run db:push' failed. Fix the error above, then rerun the command inside the project.`,
    );
  }
}

async function packageScriptExists(projectPath, scriptName) {
  const packageJsonPath = path.join(projectPath, "package.json");
  const packageJson = await readTextFileIfPresent(packageJsonPath);
  if (!packageJson) {
    return false;
  }

  try {
    const parsedPackageJson = JSON.parse(packageJson);
    return Boolean(parsedPackageJson.scripts?.[scriptName]);
  } catch {
    throw new Error("package.json is not valid JSON.");
  }
}

function readDatabaseUrl(envContent) {
  const match = envContent.match(/^DATABASE_URL\s*=\s*(["']?)(.*?)\1\s*$/m);
  return match?.[2];
}

function parseLocalDatabaseUrl(databaseUrl) {
  const url = new URL(databaseUrl);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

  if (!url.protocol.startsWith("postgres") || !localHosts.has(url.hostname)) {
    return undefined;
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database) {
    throw new Error("DATABASE_URL must include a database name.");
  }

  return {
    database,
    containerName: `${database}-postgres`,
    password: decodeURIComponent(url.password),
    port: Number(url.port || "5432"),
    url,
    username: decodeURIComponent(url.username || "postgres"),
  };
}

async function writeDatabaseUrl(envPath, dbConfig, updates) {
  const nextUrl = new URL(dbConfig.url.toString());

  if (updates.password) {
    nextUrl.password = updates.password;
  }

  if (updates.port) {
    nextUrl.port = String(updates.port);
  }

  const currentEnv = await readFile(envPath, "utf8");
  const nextEnv = currentEnv.replace(
    /^DATABASE_URL\s*=.*$/m,
    `DATABASE_URL="${nextUrl.toString()}"`,
  );
  await writeFile(envPath, nextEnv);
}

async function getContainerRuntime() {
  if (await commandAvailable("docker")) {
    await ensureContainerRuntimeIsRunning("docker");
    return "docker";
  }

  if (await commandAvailable("podman")) {
    await ensureContainerRuntimeIsRunning("podman");
    return "podman";
  }

  throw new Error("Docker or Podman is required to start local Postgres.");
}

async function commandAvailable(command) {
  try {
    await runCommandQuiet(command, ["--version"], cwd);
    return true;
  } catch {
    return false;
  }
}

async function ensureContainerRuntimeIsRunning(runtime) {
  try {
    await runCommandQuiet(runtime, ["info"], cwd);
  } catch {
    throw new Error(
      `${runtime} daemon is not running. Start ${runtime} and try again.`,
    );
  }
}

async function getContainerState(runtime, containerName) {
  try {
    const output = await runCommandOutput(
      runtime,
      ["inspect", "-f", "{{.State.Running}}", containerName],
      cwd,
    );
    return output === "true" ? "running" : "stopped";
  } catch {
    return "missing";
  }
}

async function getMappedPostgresPort(runtime, containerName) {
  try {
    const output = await runCommandOutput(
      runtime,
      ["port", containerName, "5432/tcp"],
      cwd,
    );
    const match = output.match(/:(\d+)/);
    return match ? Number(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

async function startExistingDatabaseContainer(runtime, containerName) {
  try {
    await runCommandQuiet(runtime, ["start", containerName], cwd);
  } catch {
    throw new Error(
      `Could not start '${containerName}'. Another process may already be using its mapped port. Stop that process or remove the stale container with '${runtime} rm ${containerName}'.`,
    );
  }
}

async function createDatabaseContainer(runtime, dbConfig) {
  await runCommandQuiet(
    runtime,
    [
      "run",
      "-d",
      "--name",
      dbConfig.containerName,
      "-e",
      `POSTGRES_USER=${dbConfig.username}`,
      "-e",
      `POSTGRES_PASSWORD=${dbConfig.password}`,
      "-e",
      `POSTGRES_DB=${dbConfig.database}`,
      "-p",
      `${dbConfig.port}:5432`,
      "docker.io/postgres",
    ],
    cwd,
  );
}

async function waitForDatabase(runtime, containerName, username, database) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await runCommandQuiet(
        runtime,
        ["exec", containerName, "pg_isready", "-U", username, "-d", database],
        cwd,
      );
      return;
    } catch {
      await sleep(1000);
    }
  }

  throw new Error(
    `Postgres container '${containerName}' did not become ready.`,
  );
}

async function findAvailablePort(preferredPort) {
  let port = preferredPort;
  while (await isPortOpen(port)) {
    port += 1;
  }

  return port;
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(500);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function generateDatabasePassword() {
  return randomBytes(18).toString("base64url");
}

async function installProjectDependencies(projectPath, runner) {
  const [command, args] = getInstallCommand(runner);
  await runCommand(command, args, projectPath);
}

async function addDevDependencies(projectPath, runner, packages) {
  const [command, args] = getAddDependencyCommand(runner, packages, true);
  await runCommand(command, args, projectPath);
}

function getInstallCommand(runner) {
  switch (runner) {
    case "bun":
      return ["bun", ["install"]];
    case "pnpm":
      return ["pnpm", ["install"]];
    case "npm":
      return ["npm", ["install"]];
    case "yarn":
      return ["yarn", ["install"]];
    default:
      throw new Error(`Unsupported runner: ${runner}`);
  }
}

function getAddDependencyCommand(runner, packages, dev = false) {
  switch (runner) {
    case "bun":
      return ["bun", ["add", ...(dev ? ["-d"] : []), ...packages]];
    case "pnpm":
      return ["pnpm", ["add", ...(dev ? ["-D"] : []), ...packages]];
    case "npm":
      return ["npm", ["install", ...(dev ? ["-D"] : []), ...packages]];
    case "yarn":
      return ["yarn", ["add", ...(dev ? ["-D"] : []), ...packages]];
    default:
      throw new Error(`Unsupported runner: ${runner}`);
  }
}

async function moveFileIfPresent(projectPath, from, to) {
  const sourcePath = path.join(projectPath, from);
  if (!(await pathExists(sourcePath))) {
    return;
  }

  const targetPath = path.join(projectPath, to);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await rename(sourcePath, targetPath);
}

async function replaceInFileIfPresent(projectPath, relativePath, replacements) {
  const targetPath = path.join(projectPath, relativePath);
  if (!(await pathExists(targetPath))) {
    return;
  }

  let content = await readFile(targetPath, "utf8");
  for (const [from, to] of replacements) {
    content = content.replaceAll(from, to);
  }

  await writeFile(targetPath, content);
}

async function rewriteFileIfPresent(projectPath, relativePath, rewrite) {
  const targetPath = path.join(projectPath, relativePath);
  if (!(await pathExists(targetPath))) {
    return;
  }

  const currentContent = await readFile(targetPath, "utf8");
  const nextContent = rewrite(currentContent);
  await writeFile(targetPath, nextContent);
}

async function updatePackageJson(projectPath, updater) {
  const packageJsonPath = path.join(projectPath, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const nextPackageJson = updater(packageJson);
  await writeFile(
    packageJsonPath,
    `${JSON.stringify(nextPackageJson, null, 2)}\n`,
  );
}

async function installPlaywrightBrowser(projectPath) {
  const playwrightBinary = path.join(
    projectPath,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "playwright.cmd" : "playwright",
  );

  await runCommand(playwrightBinary, ["install", "chromium"], projectPath);
}

function getVitestConfig() {
  return `import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "src/**/*.integration.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
  },
});
`;
}

function getPlaywrightConfig() {
  return `import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "bun run dev -- --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
`;
}

function formatProjectTitle(projectName) {
  return projectName
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function getProjectReadme(projectName) {
  return `# ${formatProjectTitle(projectName)}

This project was bootstrapped with Turbostart.

## Commands

\`\`\`bash
bun install
bun run dev
bun run lint
bun run typecheck
bun run test
bun run test:e2e
\`\`\`

## Stack

- Next.js App Router
- tRPC + React Query + Zod
- Drizzle ORM + Postgres
- Tailwind CSS + shadcn/ui
- Vitest + Testing Library + Playwright

## Notes

- Continue the final Pi refinement handoff to replace the remaining raw create-t3 starter UI with Turbostart-specific screens and components.
- Keep test files close to the code they verify. Reserve \`tests/e2e/**/*.spec.ts\` for Playwright.
`;
}

async function removeDirectoryIfEmpty(targetPath) {
  try {
    const entries = await readdir(targetPath);
    if (entries.length === 0) {
      await rmdir(targetPath);
    }
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }

    throw error;
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function confirmStep(message, initialValue, acceptDefault = false) {
  if (acceptDefault) {
    return initialValue;
  }

  const value = await confirm({ message, initialValue });
  stopIfCanceled(value);
  return value;
}

function stopIfCanceled(value) {
  if (isCancel(value)) {
    cancel("Canceled");
    process.exit(0);
  }
}

async function ensureCommand(command, help) {
  try {
    await runCommand(command, ["--version"], cwd, { silent: true });
  } catch {
    throw new Error(`${help}\nMissing command: ${command}`);
  }
}

async function runCommand(command, args, workingDirectory, options = {}) {
  await execa(command, args, {
    cwd: workingDirectory,
    env: process.env,
    stdio: options.silent ? "ignore" : "inherit",
  });
}

async function runCommandQuiet(command, args, workingDirectory) {
  await execa(command, args, {
    cwd: workingDirectory,
    env: process.env,
    stdio: "ignore",
  });
}

async function runCommandOutput(command, args, workingDirectory) {
  const result = await execa(command, args, {
    cwd: workingDirectory,
    env: process.env,
    stdio: "pipe",
  });
  return result.stdout.trim();
}

async function readTextFileIfPresent(targetPath) {
  try {
    return await readFile(targetPath, "utf8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return "";
    }

    throw error;
  }
}

function gitignoreHasEntry(content, entry) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .includes(entry);
}

function formatCommand(command, args) {
  return [command, ...args.map((arg) => quoteShellArgument(arg))].join(" ");
}

function quoteShellArgument(value) {
  if (/^[\w./:=,-]+$/.test(value)) {
    return value;
  }

  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

async function pathExists(targetPath) {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function isMissingFileError(error) {
  return (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

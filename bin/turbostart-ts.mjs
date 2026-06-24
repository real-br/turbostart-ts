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
  mkdir,
  readFile,
  readdir,
  rm,
  rmdir,
  stat,
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
  "pitfalls",
  "tdd-turbostart",
  "trpc-endpoint",
];
const agentGitignoreEntries = [".agents/skills/", ".pi/prompts/"];
const repoPreparationPrompt =
  "Prepare this repo according to the Turbostart stack conventions, move to shadcn, set up Vitest + Testing Library + Playwright packages and test scripts, and keep .pi/agents/reviewer.md as the repo-specific review contract.";
const assetCopies = [
  { from: "AGENTS.md", to: "AGENTS.md", label: "agent guide" },
  { from: ".pi/prompts", to: ".pi/prompts", label: "workflow prompts" },
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
    from: ".pi/agents/reviewer.md",
    to: ".pi/agents/reviewer.md",
    label: "reviewer override",
  },
  ...customSkillNames.map((skillName) => ({
    from: `.agents/skills/${skillName}`,
    to: `.agents/skills/${skillName}`,
    label: `${skillName} skill`,
  })),
];

const runnerCommands = {
  bun: ["bun", ["create", "t3-app@latest", "."]],
  pnpm: ["pnpm", ["create", "t3-app@latest", "."]],
  npm: ["npm", ["create", "t3-app@latest", "."]],
  yarn: ["yarn", ["create", "t3-app", "."]],
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
  const planVaultPath = await ensurePlanVault(projectName);
  await copyTemplateAssets(projectPath);
  log.info(`Plan vault: ${planVaultPath}`);

  const shouldInstallSkills = options.skipSkills
    ? false
    : await confirmStep(
        "Install third-party skills from online sources now?",
        true,
      );

  if (shouldInstallSkills) {
    await installAgentSkills(projectPath);
    await removeSkillInstaller(projectPath);
  } else {
    log.warn(
      "Skipped third-party skill install. Run scripts/install-agent-skills.sh inside the project later.",
    );
  }

  const shouldRunScaffold = options.skipScaffold
    ? false
    : await confirmStep(
        "Start the base scaffold CLI interactively in this folder?",
        true,
      );

  if (shouldRunScaffold) {
    const runner = await getRunner(options.runner);
    await runBaseScaffold(projectPath, runner);

    if (!options.skipDb) {
      await ensureLocalDatabase(projectPath, runner);
    }
  } else {
    log.warn(`Skipped base scaffold. Run it later from ${projectName}.`);
  }

  await ensureAgentResourcesIgnored(projectPath);

  if (shouldRunScaffold && !options.skipPi) {
    await launchPiPreparationPrompt(projectPath);
  } else if (options.skipPi) {
    log.warn(
      `Skipped pi handoff. Run ${pc.bold(formatCommand("pi", ["--approve", repoPreparationPrompt]))} inside ${projectName} later.`,
    );
  }

  outro(`Ready: cd ${path.relative(cwd, projectPath) || "."}`);
}

function parseArgs(args) {
  const program = new Command();

  program
    .name("turbostart-ts")
    .description(
      "Bootstrap a Turbostart project with agent instructions, skills, and a base scaffold handoff.",
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
    .option("--skip-scaffold", "skip interactive base scaffold handoff", false)
    .option("--skip-db", "skip local Postgres setup after scaffolding", false)
    .option(
      "--skip-pi",
      "skip the final pi preparation prompt after scaffolding",
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

async function ensurePlanVault(projectName) {
  const vaultPath = path.join(homedir(), "Obsidian", projectName);
  const plansPath = path.join(vaultPath, "plans");
  const s = spinner();
  s.start("Creating external Obsidian plan vault");
  await mkdir(plansPath, { recursive: true });
  s.stop("Created external Obsidian plan vault");
  return plansPath;
}

async function copyTemplateAssets(projectPath) {
  const s = spinner();
  s.start("Copying agent guide, prompts, installer, custom skills, and reviewer override");

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
  log.success("Gitignored agent skills and prompt templates");
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
  log.success("Pi preparation prompt finished");
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
  const [command, args] = runnerCommands[runner];
  await ensureCommand(
    command,
    `${command} is required to run the base scaffold with this runner.`,
  );

  log.step(
    `Handing over to the base scaffold: ${pc.bold(`${command} ${args.join(" ")}`)}`,
  );
  log.warn(
    "If the scaffold asks about the existing folder, continue with the current directory.",
  );

  await runCommand(command, args, projectPath);
  log.success("Base scaffold finished");
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

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function confirmStep(message, initialValue) {
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

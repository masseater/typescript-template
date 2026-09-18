// oxlint-disable-next-line import/no-nodejs-modules
import { execFile } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { mkdtemp, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { promisify } from "node:util";

// oxlint-disable-next-line typescript/strict-void-return
const run = promisify(execFile);

const CONFLICTED_FILE = "conflicted.txt";
const GIT_VARIABLE = "GIT_";
const NO_CONFIGURATION = "/dev/null";
const AUTHORED_AT = "@946684800 +0000";
const IDENTITY = "quality@example.test";

// oxlint-disable-next-line node/no-process-env
const environment = process.env;

type Scenario = (root: string) => Promise<void>;

function gitEnvironment(root: string): NodeJS.ProcessEnv {
  return {
    GIT_AUTHOR_DATE: AUTHORED_AT,
    GIT_AUTHOR_EMAIL: IDENTITY,
    GIT_AUTHOR_NAME: "quality",
    GIT_COMMITTER_DATE: AUTHORED_AT,
    GIT_COMMITTER_EMAIL: IDENTITY,
    GIT_COMMITTER_NAME: "quality",
    GIT_CONFIG_GLOBAL: NO_CONFIGURATION,
    GIT_CONFIG_SYSTEM: NO_CONFIGURATION,
    HOME: root,
    PATH: environment["PATH"] ?? "",
  };
}

function takeGitEnvironment(): Readonly<Record<string, string | undefined>> {
  const inherited = Object.keys(environment).filter((name) => name.startsWith(GIT_VARIABLE));
  const taken = Object.fromEntries(inherited.map((name) => [name, environment[name]]));
  for (const name of inherited) {
    // oxlint-disable-next-line typescript/no-dynamic-delete
    delete environment[name];
  }
  return taken;
}

async function output(root: string, args: readonly string[]): Promise<string> {
  const { stdout } = await run("git", [...args], { cwd: root, env: gitEnvironment(root) });
  return stdout;
}

async function git(root: string, ...args: readonly string[]): Promise<void> {
  await output(root, args);
}

async function stage(root: string, filename: string, content: string): Promise<void> {
  await writeFile(path.join(root, filename), content);
  await git(root, "add", filename);
}

async function commit(root: string, content: string): Promise<void> {
  await stage(root, CONFLICTED_FILE, content);
  await git(root, "commit", "-m", content.trim());
}

async function initialize(root: string): Promise<void> {
  await git(root, "init", "-b", "main");
  await commit(root, "base\n");
}

async function conflict(root: string): Promise<void> {
  await git(root, "checkout", "-b", "side");
  await commit(root, "side\n");
  await git(root, "checkout", "main");
  await commit(root, "main\n");
  await Promise.allSettled([git(root, "merge", "side")]);
  if ((await output(root, ["ls-files", "--unmerged"])) === "") {
    throw new Error(`git merge resolved ${CONFLICTED_FILE} instead of leaving it unmerged`);
  }
}

async function withDirectory(scenario: Scenario, initialized: boolean): Promise<void> {
  const inherited = takeGitEnvironment();
  const root = await mkdtemp(path.join(tmpdir(), "template-index-"));
  try {
    if (initialized) {
      await initialize(root);
    }
    await scenario(root);
  } finally {
    Object.assign(environment, inherited);
    await rm(root, { force: true, recursive: true });
  }
}

async function withRepository(scenario: Scenario): Promise<void> {
  await withDirectory(scenario, true);
}

async function withEmptyDirectory(scenario: Scenario): Promise<void> {
  await withDirectory(scenario, false);
}

export { CONFLICTED_FILE, conflict, stage, withEmptyDirectory, withRepository };

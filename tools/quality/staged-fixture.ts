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

// oxlint-disable-next-line node/no-process-env
const environment = process.env;

type Scenario = (root: string) => Promise<void>;

function takeGitEnvironment(): Readonly<Record<string, string | undefined>> {
  const inherited = Object.keys(environment).filter((name) => name.startsWith(GIT_VARIABLE));
  const taken = Object.fromEntries(inherited.map((name) => [name, environment[name]]));
  for (const name of inherited) {
    // oxlint-disable-next-line typescript/no-dynamic-delete
    delete environment[name];
  }
  return taken;
}

async function git(root: string, ...args: readonly string[]): Promise<void> {
  await run("git", [...args], { cwd: root });
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
  await git(root, "config", "user.email", "quality@example.test");
  await git(root, "config", "user.name", "quality");
  await git(root, "config", "commit.gpgsign", "false");
  await git(root, "config", "core.hooksPath", path.join(root, "absent-hooks"));
  await commit(root, "base\n");
}

async function unmergedIndex(root: string): Promise<boolean> {
  const { stdout } = await run("git", ["ls-files", "--unmerged"], { cwd: root });
  return stdout !== "";
}

async function conflict(root: string): Promise<void> {
  await git(root, "checkout", "-b", "side");
  await commit(root, "side\n");
  await git(root, "checkout", "main");
  await commit(root, "main\n");
  await Promise.allSettled([git(root, "merge", "side")]);
  if (!(await unmergedIndex(root))) {
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

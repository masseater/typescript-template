import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const IDENTITY = "quality@example.test";

const environment = process.env;

type Scenario = (root: string) => Promise<void>;

const NO_CONFIGURATION = "/dev/null";

const AUTHORED_AT = "@946684800 +0000";

const gitEnvironment = (root: string): NodeJS.ProcessEnv => {
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
    PATH: environment.PATH ?? "",
  };
};

const output = async (root: string, args: readonly string[]): Promise<string> => {
  const { stdout } = await run("git", [...args], { cwd: root, env: gitEnvironment(root) });
  return stdout;
};

const git = async (root: string, ...args: readonly string[]): Promise<void> => {
  await output(root, args);
};

const stage = async (root: string, filename: string, content: string): Promise<void> => {
  await writeFile(path.join(root, filename), content);
  await git(root, "add", filename);
};

const CONFLICTED_FILE = "conflicted.txt";

const commit = async (root: string, content: string): Promise<void> => {
  await stage(root, CONFLICTED_FILE, content);
  await git(root, "commit", "-m", content.trim());
};

const save = async (root: string, filename: string, content: string): Promise<void> => {
  await stage(root, filename, content);
  await git(root, "commit", "-m", filename);
};

const conflict = async (root: string): Promise<void> => {
  await git(root, "checkout", "-b", "side");
  await commit(root, "side\n");
  await git(root, "checkout", "main");
  await commit(root, "main\n");
  await Promise.allSettled([git(root, "merge", "side")]);
  if ((await output(root, ["ls-files", "--unmerged"])) === "") {
    throw new Error(`git merge resolved ${CONFLICTED_FILE} instead of leaving it unmerged`);
  }
};

const initialize = async (root: string): Promise<void> => {
  await git(root, "init", "-b", "main");
  await commit(root, "base\n");
};

const GIT_VARIABLE = "GIT_";

const takeGitEnvironment = (): Readonly<Record<string, string | undefined>> => {
  const inherited = Object.keys(environment).filter((name) => name.startsWith(GIT_VARIABLE));
  const taken = Object.fromEntries(inherited.map((name) => [name, environment[name]]));
  for (const name of inherited) {
    delete environment[name];
  }
  return taken;
};

const withDirectory = async (scenario: Scenario, initialized: boolean): Promise<void> => {
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
};

const withRepository = async (scenario: Scenario): Promise<void> => {
  await withDirectory(scenario, true);
};

const withEmptyDirectory = async (scenario: Scenario): Promise<void> => {
  await withDirectory(scenario, false);
};

export { CONFLICTED_FILE, conflict, save, stage, withEmptyDirectory, withRepository };

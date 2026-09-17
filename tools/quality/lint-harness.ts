// oxlint-disable-next-line import/no-nodejs-modules
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line import/no-nodejs-modules
import { once } from "node:events";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { spawn } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { text } from "node:stream/consumers";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";

interface CommandResult {
  readonly error: unknown;
  readonly output: string;
  readonly status: number | null;
}

const root = fileURLToPath(new URL("../../", import.meta.url));
const commandTimeoutMilliseconds = 20_000;
// oxlint-disable-next-line node/no-process-env
const inherited = process.env;
const environment = {
  ...inherited,
  PATH: `${path.join(root, "node_modules/.bin")}${path.delimiter}${inherited["PATH"] ?? ""}`,
};
const probeConfiguration = `export default {
      lint: {
        jsPlugins: [${JSON.stringify(path.join(root, "tools/quality/rules.ts"))}],
        categories: { correctness: "error" },
        rules: { "project/boundaries": "error", "project/no-internal-mocks": "error", "project/environment-boundary": "error", "project/worker-fetch": "error" }
      },
      test: { include: ["*.test.ts"] }
    };`;

async function withProbeDirectory<Result>(
  work: (directory: string) => Promise<Result>,
): Promise<Result> {
  const directory = await mkdtemp(path.join(tmpdir(), "typescript-template-quality-"));
  try {
    await writeFile(
      path.join(directory, "package.json"),
      JSON.stringify({
        scripts: { precommit: "vp check", prepush: "vp test run" },
        type: "module",
      }),
    );
    await writeFile(path.join(directory, "vite.config.ts"), probeConfiguration);
    return await work(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

async function runCommand(
  command: string,
  args: readonly string[],
  directory: string,
): Promise<CommandResult> {
  const child = spawn(command, args, {
    cwd: directory,
    env: environment,
    timeout: commandTimeoutMilliseconds,
  });
  try {
    const [stdout, stderr] = await Promise.all([
      text(child.stdout),
      text(child.stderr),
      once(child, "close"),
    ]);
    return { error: undefined, output: stdout + stderr, status: child.exitCode };
  } catch (error) {
    return { error, output: "", status: child.exitCode };
  }
}

async function lintProbe(name: string, code: string): Promise<CommandResult> {
  return withProbeDirectory(async (directory) => {
    const target = path.join(directory, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, code);
    return runCommand("vp", ["lint", name], directory);
  });
}

export { lintProbe, root, runCommand, withProbeDirectory };

// oxlint-disable-next-line import/no-nodejs-modules
import { access, constants } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { once } from "node:events";
// oxlint-disable-next-line import/no-nodejs-modules
import { spawn } from "node:child_process";

const FIRST_USER_ARGUMENT_INDEX = 2;

const root = `${import.meta.dirname}/../../..`;
const composeFile = `${import.meta.dirname}/../compose.yaml`;
const bundledCompose = "/Applications/OrbStack.app/Contents/MacOS/xbin/docker-compose";
const [action] = process.argv.slice(FIRST_USER_ARGUMENT_INDEX);
const actions: Readonly<Record<string, readonly string[]>> = {
  config: ["config", "--quiet"],
  logs: ["logs", "--no-color", "--tail", "100", "mailpit"],
  status: ["ps", "--format", "json"],
  up: ["up", "-d", "--wait"],
};

function composeArguments(name: string | undefined): readonly string[] {
  const args = name === undefined || !Object.hasOwn(actions, name) ? undefined : actions[name];
  if (args === undefined) {
    throw new Error("Unknown local service action");
  }
  return args;
}

async function runCompose(args: readonly string[]): Promise<void> {
  const bundled = await access(bundledCompose, constants.X_OK).then(
    () => true,
    () => false,
  );
  const child = spawn(
    bundled ? bundledCompose : "docker",
    [...(bundled ? [] : ["compose"]), "-f", composeFile, ...args],
    { cwd: root, stdio: "inherit" },
  );
  const exitArguments: unknown[] = await once(child, "exit");
  const [code] = exitArguments;
  if (code !== 0) {
    throw new Error("Compose command failed");
  }
}

try {
  await runCompose(composeArguments(action));
} catch {
  process.stderr.write(
    `${JSON.stringify({
      event: "local.services_command_failed",
      ok: false,
      remediation: "Check the Docker daemon, then retry the requested action.",
    })}\n`,
  );
  process.exitCode = 1;
}

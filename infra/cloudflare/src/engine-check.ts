import { array, literal, object, parse } from "valibot";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { userInfo } from "node:os";

const FIRST_USER_ARGUMENT_INDEX = 2;
const PASSPHRASE_BYTES = 32;
const MAX_OUTPUT_BYTES = 8_388_608;
const COMMAND_TIMEOUT_MS = 60_000;
const OWNER_ONLY_DIRECTORY_MODE = 0o700;
const OWNER_ONLY_FILE_MODE = 0o600;

const probeProgram = fileURLToPath(new URL("runtime-probe.ts", import.meta.url));
const runtimeEvidenceSchema = object({
  compilerLoaded: literal(false),
  engineConnected: literal(true),
  monitorConnected: literal(true),
  secretPreserved: literal(true),
});
const outputsSchema = object({
  probeSecret: literal("[secret]"),
  runtimeEvidence: runtimeEvidenceSchema,
});
const stackResourceSchema = object({ type: literal("pulumi:pulumi:Stack") });
const checkpointSchema = object({
  deployment: object({ resources: array(stackResourceSchema) }),
});

interface Sandbox {
  readonly binary: string;
  readonly environment: Readonly<NodeJS.ProcessEnv>;
  readonly isolated: string;
  readonly project: string;
}

async function writeCommandLog(sandbox: Sandbox, label: string, content: string): Promise<void> {
  await writeFile(path.join(sandbox.isolated, `${label}.log`), content, {
    mode: OWNER_ONLY_FILE_MODE,
  });
}

async function command(sandbox: Sandbox, label: string, args: readonly string[]): Promise<string> {
  try {
    const result = await promisify(execFile)(
      "/usr/bin/sandbox-exec",
      [
        "-p",
        `(version 1)(allow default)(deny network-outbound)(allow network-outbound (remote ip "localhost:*"))(deny file-write*)(allow file-write* (subpath ${JSON.stringify(sandbox.isolated)}) (literal "/dev/null"))`,
        sandbox.binary,
        ...args,
      ],
      {
        cwd: sandbox.project,
        env: sandbox.environment,
        maxBuffer: MAX_OUTPUT_BYTES,
        timeout: COMMAND_TIMEOUT_MS,
      },
    );
    await writeCommandLog(sandbox, label, result.stdout + result.stderr);
    return result.stdout;
  } catch (error: unknown) {
    if (error instanceof Error && "stdout" in error && "stderr" in error) {
      await writeCommandLog(sandbox, label, `${String(error.stdout)}${String(error.stderr)}`);
    }
    throw new Error(`engine_${label}_failed`, { cause: error });
  }
}

async function localCliBinary(root: string): Promise<string> {
  const [executable] = process.argv.slice(FIRST_USER_ARGUMENT_INDEX);
  if (executable === undefined || !path.isAbsolute(executable)) {
    throw new Error("local_cli_path_required");
  }
  const binary = await realpath(executable);
  if (!binary.startsWith(path.join(root, ".local", "tools") + path.sep)) {
    throw new Error("local_cli_path_required");
  }
  return binary;
}

async function writeProbeProject(project: string): Promise<void> {
  await writeFile(
    path.join(project, "Pulumi.yaml"),
    [
      "name: template-runtime-probe",
      "runtime:",
      "  name: nodejs",
      "  options:",
      "    typescript: false",
      "    nodeargs: --import tsx",
      `main: ${JSON.stringify(probeProgram)}`,
      "",
    ].join("\n"),
    { mode: OWNER_ONLY_FILE_MODE },
  );
  await writeFile(
    path.join(project, "package.json"),
    JSON.stringify({
      name: "template-runtime-probe",
      private: true,
      type: "module",
    }),
    { mode: OWNER_ONLY_FILE_MODE },
  );
}

function sandboxEnvironment(isolated: string, state: string): NodeJS.ProcessEnv {
  const { homedir, username } = userInfo();
  return {
    HOME: homedir,
    PATH: process.env["PATH"],
    PULUMI_BACKEND_URL: pathToFileURL(state).href,
    PULUMI_CONFIG_PASSPHRASE: randomBytes(PASSPHRASE_BYTES).toString("hex"),
    PULUMI_DISABLE_AUTOMATIC_PLUGIN_ACQUISITION: "true",
    PULUMI_DISABLE_CHECKPOINT_BACKUPS: "true",
    PULUMI_HOME: path.join(isolated, "pulumi-home"),
    PULUMI_IGNORE_AMBIENT_PLUGINS: "true",
    PULUMI_SKIP_UPDATE_CHECK: "true",
    TEMPLATE_ENGINE_PROBE: "true",
    TMPDIR: path.join(isolated, "tmp"),
    TSX_DISABLE_CACHE: "1",
    USER: username,
  };
}

async function createSandbox(root: string): Promise<Sandbox> {
  const binary = await localCliBinary(root);
  if (process.platform !== "darwin") {
    throw new Error("network_sandbox_requires_macos");
  }
  const isolated = await mkdtemp(path.join(root, ".local", "pulumi-engine-"));
  const project = path.join(isolated, "project");
  const state = path.join(isolated, "state");
  await Promise.all(
    [project, state, path.join(isolated, "tmp")].map(async (directory) => {
      await mkdir(directory, { mode: OWNER_ONLY_DIRECTORY_MODE });
    }),
  );
  await writeProbeProject(project);
  return { binary, environment: sandboxEnvironment(isolated, state), isolated, project };
}

try {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const sandbox = await createSandbox(root);
  const version = await command(sandbox, "version", ["version"]);
  assert.equal(version.trim(), "v3.262.0");
  await command(sandbox, "init", [
    "stack",
    "init",
    "isolated",
    "--secrets-provider",
    "passphrase",
    "--non-interactive",
  ]);
  await command(sandbox, "preview", ["preview", "--non-interactive", "--json"]);
  await command(sandbox, "up", ["up", "--yes", "--skip-preview", "--non-interactive", "--json"]);
  const output: unknown = JSON.parse(
    await command(sandbox, "outputs", ["stack", "output", "--json"]),
  );
  const evidence = parse(outputsSchema, output);
  const checkpoint: unknown = JSON.parse(await command(sandbox, "export", ["stack", "export"]));
  const verifiedState = parse(checkpointSchema, checkpoint);
  assert.equal(verifiedState.deployment.resources.length, 1);
  process.stdout.write(
    `${JSON.stringify({
      cliVersion: "3.262.0",
      event: "pulumi.engine_verified",
      ...evidence.runtimeEvidence,
      cloudResources: 0,
      evidenceDirectory: sandbox.isolated,
      outboundNetwork: "loopback-only",
    })}\n`,
  );
} catch (error: unknown) {
  const code =
    error instanceof Error && /^engine_[a-z]+_failed$/u.test(error.message)
      ? error.message
      : "engine_verification_failed";
  process.stderr.write(`${JSON.stringify({ event: code })}\n`);
  process.exitCode = 1;
}

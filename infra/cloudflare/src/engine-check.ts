import { Effect, Schema } from "effect";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath, pathToFileURL } from "node:url";
// oxlint-disable-next-line import/no-nodejs-modules
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import { NodeRuntime } from "@effect/platform-node";
// oxlint-disable-next-line import/no-nodejs-modules
import { execFile } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { promisify } from "node:util";
// oxlint-disable-next-line import/no-nodejs-modules
import { userInfo } from "node:os";

const FIRST_USER_ARGUMENT_INDEX = 2;
const PASSPHRASE_BYTES = 32;
const MAX_OUTPUT_BYTES = 8_388_608;
const COMMAND_TIMEOUT_MS = 60_000;
const OWNER_ONLY_DIRECTORY_MODE = 0o700;
const OWNER_ONLY_FILE_MODE = 0o600;

class EngineFailure extends Schema.TaggedError<EngineFailure>()("EngineFailure", {
  code: Schema.Literals([
    "engine_verification_failed",
    "engine_version_failed",
    "engine_init_failed",
    "engine_preview_failed",
    "engine_up_failed",
    "engine_outputs_failed",
    "engine_export_failed",
  ]),
}) {}

type EngineLabel = "version" | "init" | "preview" | "up" | "outputs" | "export";

interface Sandbox {
  readonly binary: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly isolated: string;
  readonly project: string;
}

const probeProgram = fileURLToPath(new URL("runtime-probe.ts", import.meta.url));
const RuntimeEvidence = Schema.Struct({
  compilerLoaded: Schema.Literal(false),
  engineConnected: Schema.Literal(true),
  monitorConnected: Schema.Literal(true),
  secretPreserved: Schema.Literal(true),
});
const Outputs = Schema.Struct({
  probeSecret: Schema.Literal("[secret]"),
  runtimeEvidence: RuntimeEvidence,
});
const StackResource = Schema.Struct({ type: Schema.Literal("pulumi:pulumi:Stack") });
const Deployment = Schema.Struct({ resources: Schema.Array(StackResource) });
const Checkpoint = Schema.Struct({ deployment: Deployment });

function verificationFailed(): EngineFailure {
  return new EngineFailure({ code: "engine_verification_failed" });
}

function step<Value>(run: () => Promise<Value>): Effect.Effect<Value, EngineFailure> {
  return Effect.tryPromise({ catch: verificationFailed, try: run });
}

function decodeJson<Contract extends Schema.Top & { readonly DecodingServices: never }>(
  contract: Contract,
  text: string,
): Effect.Effect<Contract["Type"], EngineFailure> {
  return Schema.decodeUnknownEffect(Schema.fromJsonString(contract))(text).pipe(
    Effect.mapError(verificationFailed),
  );
}

function writeCommandLog(
  sandbox: Sandbox,
  label: EngineLabel,
  content: string,
): Effect.Effect<void, EngineFailure> {
  return step(async () =>
    writeFile(path.join(sandbox.isolated, `${label}.log`), content, {
      mode: OWNER_ONLY_FILE_MODE,
    }),
  );
}

function failedOutput(cause: unknown): string | undefined {
  return cause instanceof Error && "stdout" in cause && "stderr" in cause
    ? `${String(cause.stdout)}${String(cause.stderr)}`
    : undefined;
}

const command = Effect.fn("command")(function* command(
  sandbox: Sandbox,
  label: EngineLabel,
  args: readonly string[],
) {
  const failed = new EngineFailure({ code: `engine_${label}_failed` });
  const result = yield* Effect.tryPromise({
    catch: (cause) => ({ cause }),
    try: async () =>
      // oxlint-disable-next-line typescript/strict-void-return
      promisify(execFile)(
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
      ),
  }).pipe(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.catch(({ cause }) => {
      const output = failedOutput(cause);
      const logged = output === undefined ? Effect.void : writeCommandLog(sandbox, label, output);
      return logged.pipe(Effect.andThen(Effect.fail(failed)));
    }),
  );
  yield* writeCommandLog(sandbox, label, result.stdout + result.stderr);
  return result.stdout;
});

const localCliBinary = Effect.fn("localCliBinary")(function* localCliBinary(root: string) {
  const [executable] = process.argv.slice(FIRST_USER_ARGUMENT_INDEX);
  if (executable === undefined || !path.isAbsolute(executable)) {
    return yield* verificationFailed();
  }
  const binary = yield* step(async () => realpath(executable));
  if (!binary.startsWith(path.join(root, ".local", "tools") + path.sep)) {
    return yield* verificationFailed();
  }
  return binary;
});

async function writeProbeProject(project: string): Promise<void> {
  await writeFile(
    path.join(project, "Pulumi.yaml"),
    [
      "name: template-runtime-probe",
      "runtime:",
      "  name: nodejs",
      "  options:",
      "    typescript: false",
      `main: ${JSON.stringify(probeProgram)}`,
      "",
    ].join("\n"),
    { mode: OWNER_ONLY_FILE_MODE },
  );
  await writeFile(
    path.join(project, "package.json"),
    JSON.stringify({ name: "template-runtime-probe", private: true, type: "module" }),
    { mode: OWNER_ONLY_FILE_MODE },
  );
}

function sandboxEnvironment(isolated: string, state: string): Sandbox["environment"] {
  const { homedir, username } = userInfo();
  return {
    HOME: homedir,
    // oxlint-disable-next-line node/no-process-env
    PATH: process.env["PATH"],
    PULUMI_BACKEND_URL: pathToFileURL(state).href,
    PULUMI_CONFIG_PASSPHRASE: Buffer.from(
      crypto.getRandomValues(new Uint8Array(PASSPHRASE_BYTES)),
    ).toString("hex"),
    PULUMI_DISABLE_AUTOMATIC_PLUGIN_ACQUISITION: "true",
    PULUMI_DISABLE_CHECKPOINT_BACKUPS: "true",
    PULUMI_HOME: path.join(isolated, "pulumi-home"),
    PULUMI_IGNORE_AMBIENT_PLUGINS: "true",
    PULUMI_SKIP_UPDATE_CHECK: "true",
    TEMPLATE_ENGINE_PROBE: "true",
    TMPDIR: path.join(isolated, "tmp"),
    USER: username,
  };
}

const createSandbox = Effect.fn("createSandbox")(function* createSandbox(root: string) {
  const binary = yield* localCliBinary(root);
  if (process.platform !== "darwin") {
    return yield* verificationFailed();
  }
  const isolated = yield* step(async () => mkdtemp(path.join(root, ".local", "pulumi-engine-")));
  const project = path.join(isolated, "project");
  const state = path.join(isolated, "state");
  yield* step(async () =>
    Promise.all(
      [project, state, path.join(isolated, "tmp")].map(async (directory) =>
        mkdir(directory, { mode: OWNER_ONLY_DIRECTORY_MODE }),
      ),
    ),
  );
  yield* step(async () => writeProbeProject(project));
  const sandbox: Sandbox = {
    binary,
    environment: sandboxEnvironment(isolated, state),
    isolated,
    project,
  };
  return sandbox;
});

const applyProbe = Effect.fn("applyProbe")(function* applyProbe(sandbox: Sandbox) {
  if ((yield* command(sandbox, "version", ["version"])).trim() !== "v3.262.0") {
    return yield* verificationFailed();
  }
  yield* command(sandbox, "init", [
    "stack",
    "init",
    "isolated",
    "--secrets-provider",
    "passphrase",
    "--non-interactive",
  ]);
  yield* command(sandbox, "preview", ["preview", "--non-interactive", "--json"]);
  return yield* command(sandbox, "up", [
    "up",
    "--yes",
    "--skip-preview",
    "--non-interactive",
    "--json",
  ]);
});

const verifyEngine = Effect.fn("verifyEngine")(function* verifyEngine() {
  const sandbox = yield* createSandbox(fileURLToPath(new URL("../../../", import.meta.url)));
  yield* applyProbe(sandbox);
  const evidence = yield* decodeJson(
    Outputs,
    yield* command(sandbox, "outputs", ["stack", "output", "--json"]),
  );
  const verifiedState = yield* decodeJson(
    Checkpoint,
    yield* command(sandbox, "export", ["stack", "export"]),
  );
  if (verifiedState.deployment.resources.length !== 1) {
    return yield* verificationFailed();
  }
  return { evidence: evidence.runtimeEvidence, isolated: sandbox.isolated };
});

function report(code: EngineFailure["code"]): Effect.Effect<void> {
  return Effect.sync(() => {
    process.stderr.write(`${JSON.stringify({ event: code })}\n`);
    process.exitCode = 1;
  });
}

NodeRuntime.runMain(
  verifyEngine().pipe(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.flatMap(({ evidence, isolated }) =>
      Effect.sync(() => {
        process.stdout.write(
          `${JSON.stringify({
            cliVersion: "3.262.0",
            event: "pulumi.engine_verified",
            ...evidence,
            cloudResources: 0,
            evidenceDirectory: isolated,
            outboundNetwork: "loopback-only",
          })}\n`,
        );
      }),
    ),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.catchTag("EngineFailure", (failure) => report(failure.code)),
    Effect.catchCause(() => report("engine_verification_failed")),
  ),
  { disableErrorReporting: true },
);

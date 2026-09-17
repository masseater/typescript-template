import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { userInfo } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { NodeRuntime } from "@effect/platform-node";
import { Effect, Schema } from "effect";

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

const verificationFailed = () => new EngineFailure({ code: "engine_verification_failed" });

const step = <A>(run: () => Promise<A>) =>
  Effect.tryPromise({ try: run, catch: verificationFailed });

const RuntimeOutputs = Schema.fromJsonString(
  Schema.Struct({
    runtimeEvidence: Schema.Struct({
      engineConnected: Schema.Literal(true),
      monitorConnected: Schema.Literal(true),
      compilerLoaded: Schema.Literal(false),
      secretPreserved: Schema.Literal(true),
    }),
    probeSecret: Schema.Literal("[secret]"),
  }),
);

const Checkpoint = Schema.fromJsonString(
  Schema.Struct({
    deployment: Schema.Struct({
      resources: Schema.Array(Schema.Struct({ type: Schema.Literal("pulumi:pulumi:Stack") })),
    }),
  }),
);

const sandboxCommand = Effect.fn("sandboxCommand")(function* (
  sandbox: {
    readonly binary: string;
    readonly isolated: string;
    readonly project: string;
    readonly environment: Record<string, string | undefined>;
  },
  label: EngineLabel,
  args: readonly string[],
) {
  const failed = new EngineFailure({ code: `engine_${label}_failed` });
  const log = path.join(sandbox.isolated, `${label}.log`);
  const result = yield* Effect.tryPromise({
    try: () =>
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
          timeout: 60_000,
          maxBuffer: 8 * 1024 * 1024,
        },
      ),
    catch: (cause) => ({ cause }),
  }).pipe(
    Effect.catch(({ cause: error }) =>
      (error instanceof Error && "stdout" in error && "stderr" in error
        ? Effect.tryPromise(() =>
            writeFile(log, `${String(error.stdout)}${String(error.stderr)}`, { mode: 0o600 }),
          ).pipe(Effect.mapError(verificationFailed))
        : Effect.void
      ).pipe(Effect.andThen(Effect.fail(failed))),
    ),
  );
  yield* Effect.tryPromise({
    try: () => writeFile(log, result.stdout + result.stderr, { mode: 0o600 }),
    catch: () => failed,
  });
  return result.stdout;
});

const report = (code: EngineFailure["code"]) =>
  Effect.sync(() => {
    console.error(JSON.stringify({ event: code }));
    process.exitCode = 1;
  });

NodeRuntime.runMain(
  Effect.gen(function* () {
    const root = fileURLToPath(new URL("../../../", import.meta.url));
    const executable = process.argv[2];
    if (!executable || !path.isAbsolute(executable)) return yield* verificationFailed();
    const binary = yield* step(() => realpath(executable));
    if (!binary.startsWith(path.join(root, ".local", "tools") + path.sep))
      return yield* verificationFailed();
    if (process.platform !== "darwin") return yield* verificationFailed();
    const isolated = yield* step(() => mkdtemp(path.join(root, ".local", "pulumi-engine-")));
    const project = path.join(isolated, "project");
    const state = path.join(isolated, "state");
    yield* step(async () => {
      await mkdir(project, { mode: 0o700 });
      await mkdir(state, { mode: 0o700 });
      await mkdir(path.join(isolated, "tmp"), { mode: 0o700 });
      await writeFile(
        path.join(project, "Pulumi.yaml"),
        [
          "name: template-runtime-probe",
          "runtime:",
          "  name: nodejs",
          "  options:",
          "    typescript: false",
          "    nodeargs: --import tsx",
          `main: ${JSON.stringify(fileURLToPath(new URL("./runtime-probe.ts", import.meta.url)))}`,
          "",
        ].join("\n"),
        { mode: 0o600 },
      );
      await writeFile(
        path.join(project, "package.json"),
        JSON.stringify({
          name: "template-runtime-probe",
          private: true,
          type: "module",
        }),
        { mode: 0o600 },
      );
    });
    const sandbox = {
      binary,
      isolated,
      project,
      environment: {
        PATH: process.env["PATH"],
        USER: userInfo().username,
        HOME: userInfo().homedir,
        TMPDIR: path.join(isolated, "tmp"),
        TSX_DISABLE_CACHE: "1",
        PULUMI_HOME: path.join(isolated, "pulumi-home"),
        PULUMI_BACKEND_URL: pathToFileURL(state).href,
        PULUMI_CONFIG_PASSPHRASE: randomBytes(32).toString("hex"),
        PULUMI_DISABLE_AUTOMATIC_PLUGIN_ACQUISITION: "true",
        PULUMI_IGNORE_AMBIENT_PLUGINS: "true",
        PULUMI_SKIP_UPDATE_CHECK: "true",
        PULUMI_DISABLE_CHECKPOINT_BACKUPS: "true",
        TEMPLATE_ENGINE_PROBE: "true",
      },
    };
    if ((yield* sandboxCommand(sandbox, "version", ["version"])).trim() !== "v3.262.0")
      return yield* verificationFailed();
    yield* sandboxCommand(sandbox, "init", [
      "stack",
      "init",
      "isolated",
      "--secrets-provider",
      "passphrase",
      "--non-interactive",
    ]);
    yield* sandboxCommand(sandbox, "preview", ["preview", "--non-interactive", "--json"]);
    yield* sandboxCommand(sandbox, "up", [
      "up",
      "--yes",
      "--skip-preview",
      "--non-interactive",
      "--json",
    ]);
    const evidence = yield* sandboxCommand(sandbox, "outputs", ["stack", "output", "--json"]).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(RuntimeOutputs)),
      Effect.mapError((error) => (error._tag === "EngineFailure" ? error : verificationFailed())),
    );
    const verifiedState = yield* sandboxCommand(sandbox, "export", ["stack", "export"]).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(Checkpoint)),
      Effect.mapError((error) => (error._tag === "EngineFailure" ? error : verificationFailed())),
    );
    if (verifiedState.deployment.resources.length !== 1) return yield* verificationFailed();
    console.log(
      JSON.stringify({
        event: "pulumi.engine_verified",
        cliVersion: "3.262.0",
        ...evidence.runtimeEvidence,
        cloudResources: 0,
        outboundNetwork: "loopback-only",
        evidenceDirectory: isolated,
      }),
    );
  }).pipe(
    Effect.catchTag("EngineFailure", (failure) => report(failure.code)),
    Effect.catchCause(() => report("engine_verification_failed")),
  ),
  { disableErrorReporting: true },
);

import { NodeServices } from "@effect/platform-node";
import { Effect, Schema, Stream, type PlatformError } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { filesystem, paths } from "./host.ts";

class CompilerUnavailable extends Schema.TaggedError<CompilerUnavailable>()("CompilerUnavailable", {
  transcript: Schema.String,
}) {
  override get message(): string {
    return this.transcript;
  }
}

const EffectTsgoManifest = Schema.fromJsonString(
  Schema.Struct({ bin: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)) }),
);

const effectTsgoBin = Effect.gen(function* effectTsgoBin() {
  const packageJsonPath = yield* paths.fromFileUrl(
    new URL(import.meta.resolve("@effect/tsgo/package.json")),
  );
  const manifest = yield* Schema.decodeEffect(EffectTsgoManifest)(
    yield* filesystem.readFileString(packageJsonPath),
  );
  const relativeBin = manifest.bin?.["effect-tsgo"];
  if (relativeBin === undefined) {
    return yield* new CompilerUnavailable({
      transcript: "typecheck gate: @effect/tsgo is missing the effect-tsgo bin",
    });
  }
  return paths.join(paths.dirname(packageJsonPath), relativeBin);
});

type SpawnTranscript = {
  readonly status: number;
  readonly stderr: string;
  readonly stdout: string;
};

const spawnTranscript = (
  invocation: Readonly<{
    executable: string;
    commandArguments: readonly string[];
    cwd?: string;
  }>,
): Effect.Effect<SpawnTranscript, PlatformError.PlatformError> =>
  Effect.gen(function* spawnTranscript() {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const handle = yield* spawner.spawn(
      ChildProcess.make(invocation.executable, [...invocation.commandArguments], {
        ...(invocation.cwd === undefined ? {} : { cwd: invocation.cwd }),
        stdin: "ignore",
      }),
    );
    const [stdout, stderr, exitCode] = yield* Effect.all(
      [
        Stream.mkString(Stream.decodeText(handle.stdout)),
        Stream.mkString(Stream.decodeText(handle.stderr)),
        handle.exitCode,
      ],
      { concurrency: "unbounded" },
    );
    const transcript: SpawnTranscript = { status: exitCode, stderr, stdout };
    return transcript;
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer));

type CompilerResult = {
  readonly output: string;
  readonly status: number;
};

const combinedOutput = (spawned: SpawnTranscript): CompilerResult => ({
  output: `${spawned.stdout}${spawned.stderr}`,
  status: spawned.status,
});

const locateCompiler = Effect.gen(function* locateCompiler() {
  const resolution = yield* spawnTranscript({
    executable: process.execPath,
    commandArguments: [yield* effectTsgoBin, "get-exe-path"],
  });
  const executable = resolution.stdout.trim();
  if (resolution.status !== 0 || executable === "") {
    return yield* new CompilerUnavailable({
      transcript: combinedOutput(resolution).output || "typecheck gate: compiler not found",
    });
  }
  return executable;
});

const compileWorkspace = (
  asked: Readonly<{
    cwd: string;
    locate?: Effect.Effect<string, Error>;
  }>,
): Effect.Effect<CompilerResult> =>
  Effect.gen(function* compileWorkspace() {
    const executable = yield* asked.locate ?? locateCompiler;
    return combinedOutput(
      yield* spawnTranscript({
        executable,
        commandArguments: ["--pretty", "false", "--noEmit", "-p", "tsconfig.json"],
        cwd: asked.cwd,
      }),
    );
  }).pipe(
    Effect.match({
      onFailure: (compilerFailure): CompilerResult => ({
        output: `${compilerFailure.message}\n`,
        status: 1,
      }),
      onSuccess: (compiled) => compiled,
    }),
  );

export { compileWorkspace };
export type { CompilerResult };
